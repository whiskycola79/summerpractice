import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Firebase-konfiguration
const firebaseConfig = {
  apiKey: "AIzaSyBXeoBhghAFZjnRYngQ19TacJiWIUdKJWY",
  authDomain: "summerpractice-2026.firebaseapp.com",
  projectId: "summerpractice-2026",
  storageBucket: "summerpractice-2026.firebasestorage.app",
  messagingSenderId: "719383550520",
  appId: "1:719383550520:web:f5fe9d4d2d98f360d7e4cd"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;

// ─── AUTH STATE ───────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    const name = user.displayName || user.email.split("@")[0];
    document.getElementById("nav-username").textContent = name;
    document.getElementById("welcome-name").textContent = name;
    showPage("page-main");
    showSection("dashboard");
    await loadDashboard();
  } else {
    currentUser = null;
    showPage("page-auth");
  }
});

// ─── REGISTRERING ─────────────────────────────────────────
window.registerUser = async () => {
  const name = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const errEl = document.getElementById("reg-error");
  errEl.textContent = "";

  if (!name || !email || !password) {
    errEl.textContent = "Fyll i alla fält."; return;
  }
  if (password.length < 6) {
    errEl.textContent = "Lösenordet måste vara minst 6 tecken."; return;
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    // Spara spelarinfo i Firestore
    await setDoc(doc(db, "users", cred.user.uid), {
      name,
      email,
      createdAt: serverTimestamp(),
      totalMinutes: 0,
      totalSessions: 0
    });
  } catch (e) {
    errEl.textContent = firebaseError(e.code);
  }
};

// ─── INLOGGNING ───────────────────────────────────────────
window.loginUser = async () => {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errEl = document.getElementById("login-error");
  errEl.textContent = "";

  if (!email || !password) {
    errEl.textContent = "Fyll i e-post och lösenord."; return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    errEl.textContent = firebaseError(e.code);
  }
};

// ─── UTLOGGNING ───────────────────────────────────────────
window.logoutUser = async () => {
  await signOut(auth);
};

// ─── SPARA TRÄNING ────────────────────────────────────────
window.saveSession = async () => {
  const date = document.getElementById("log-date").value;
  const type = document.getElementById("log-type").value;
  const minutes = parseInt(document.getElementById("log-minutes").value);
  const notes = document.getElementById("log-notes").value.trim();
  const successEl = document.getElementById("log-success");
  const errEl = document.getElementById("log-error");
  successEl.textContent = "";
  errEl.textContent = "";

  if (!date) { errEl.textContent = "Välj ett datum."; return; }
  if (!minutes || minutes < 1) { errEl.textContent = "Ange antal minuter."; return; }

  try {
    await addDoc(collection(db, "sessions"), {
      userId: currentUser.uid,
      userName: currentUser.displayName || currentUser.email,
      date,
      type,
      minutes,
      notes,
      createdAt: serverTimestamp()
    });

    // Uppdatera användarens totaler
    const userRef = doc(db, "users", currentUser.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const data = userSnap.data();
      await setDoc(userRef, {
        ...data,
        totalMinutes: (data.totalMinutes || 0) + minutes,
        totalSessions: (data.totalSessions || 0) + 1
      });
    }

    successEl.textContent = "✅ Träning sparad!";
    document.getElementById("log-minutes").value = "";
    document.getElementById("log-notes").value = "";
    document.getElementById("log-date").value = "";

    setTimeout(() => { successEl.textContent = ""; }, 3000);
    await loadDashboard();
  } catch (e) {
    errEl.textContent = "Kunde inte spara: " + e.message;
  }
};

// ─── LADDA DASHBOARD ──────────────────────────────────────
async function loadDashboard() {
  try {
    const q = query(
      collection(db, "sessions"),
      where("userId", "==", currentUser.uid),
      orderBy("date", "desc")
    );
    const snap = await getDocs(q);
    const sessions = snap.docs.map(d => d.data());

    const totalMinutes = sessions.reduce((s, x) => s + x.minutes, 0);
    const totalSessions = sessions.length;

    // Beräkna streak (dagar i rad)
    const streak = calcStreak(sessions);

    document.getElementById("stat-sessions").textContent = totalSessions;
    document.getElementById("stat-minutes").textContent = totalMinutes;
    document.getElementById("stat-streak").textContent = streak;
  } catch (e) {
    console.error("Dashboard error:", e);
  }
}

// ─── LADDA HISTORIK ───────────────────────────────────────
async function loadHistory() {
  const list = document.getElementById("history-list");
  list.innerHTML = "<p class='empty-state'>Laddar...</p>";

  try {
    const q = query(
      collection(db, "sessions"),
      where("userId", "==", currentUser.uid),
      orderBy("date", "desc")
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      list.innerHTML = "<p class='empty-state'>Inga träningar loggade ännu. Lägg till din första träning! 🏀</p>";
      return;
    }

    list.innerHTML = "";
    snap.docs.forEach(docSnap => {
      const s = docSnap.data();
      const item = document.createElement("div");
      item.className = "history-item";
      item.innerHTML = `
        <div class="history-icon">${typeIcon(s.type)}</div>
        <div class="history-info">
          <div class="history-type">${s.type}</div>
          <div class="history-date">${formatDate(s.date)}</div>
          ${s.notes ? `<div class="history-notes">${s.notes}</div>` : ""}
        </div>
        <div class="history-minutes">${s.minutes}<span>min</span></div>
      `;
      list.appendChild(item);
    });
  } catch (e) {
    list.innerHTML = "<p class='empty-state'>Kunde inte ladda historik.</p>";
  }
}

// ─── LADDA TOPPLISTA ──────────────────────────────────────
async function loadLeaderboard() {
  const list = document.getElementById("leaderboard-list");
  list.innerHTML = "<p class='empty-state'>Laddar...</p>";

  try {
    const snap = await getDocs(collection(db, "users"));
    const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    users.sort((a, b) => (b.totalMinutes || 0) - (a.totalMinutes || 0));

    if (users.length === 0) {
      list.innerHTML = "<p class='empty-state'>Inga spelare ännu.</p>";
      return;
    }

    list.innerHTML = "";
    users.forEach((u, i) => {
      const rank = i + 1;
      const isMe = u.id === currentUser.uid;
      const rankEmoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}.`;
      const cls = rank === 1 ? "top-1" : rank === 2 ? "top-2" : rank === 3 ? "top-3" : "";
      const item = document.createElement("div");
      item.className = `leaderboard-item ${cls} ${isMe ? "me" : ""}`;
      item.innerHTML = `
        <div class="lb-rank">${rankEmoji}</div>
        <div class="lb-info" style="flex:1">
          <div class="lb-name">${u.name || u.email}${isMe ? " (du)" : ""}</div>
          <div class="lb-sessions">${u.totalSessions || 0} pass</div>
        </div>
        <div class="lb-minutes">${u.totalMinutes || 0}<span>minuter</span></div>
      `;
      list.appendChild(item);
    });
  } catch (e) {
    list.innerHTML = "<p class='empty-state'>Kunde inte ladda topplistan.</p>";
  }
}

// ─── HJÄLPFUNKTIONER ──────────────────────────────────────
window.showSection = (id) => {
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("section-" + id).classList.add("active");
  const btns = document.querySelectorAll(".nav-btn");
  btns.forEach(b => { if (b.getAttribute("onclick")?.includes(id)) b.classList.add("active"); });

  if (id === "history") loadHistory();
  if (id === "leaderboard") loadLeaderboard();
  if (id === "log") {
    // Sätt dagens datum som default
    const today = new Date().toISOString().split("T")[0];
    document.getElementById("log-date").value = today;
  }
};

window.switchTab = (tab) => {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
  document.querySelector(`.tab[onclick="switchTab('${tab}')"]`).classList.add("active");
  document.getElementById("tab-" + tab).classList.add("active");
};

function showPage(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function typeIcon(type) {
  const icons = {
    "Skottträning": "🏀", "Dribbling": "⚡", "Kondition": "🏃",
    "Styrketräning": "💪", "Lagträning": "👥", "Match": "🏆", "Övrigt": "📋"
  };
  return icons[type] || "🏀";
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function calcStreak(sessions) {
  if (!sessions.length) return 0;
  const dates = [...new Set(sessions.map(s => s.date))].sort().reverse();
  let streak = 0;
  let current = new Date();
  current.setHours(0, 0, 0, 0);

  for (const dateStr of dates) {
    const d = new Date(dateStr);
    const diff = Math.round((current - d) / (1000 * 60 * 60 * 24));
    if (diff <= 1) { streak++; current = d; }
    else break;
  }
  return streak;
}

function firebaseError(code) {
  const errors = {
    "auth/email-already-in-use": "E-postadressen används redan.",
    "auth/invalid-email": "Ogiltig e-postadress.",
    "auth/weak-password": "För svagt lösenord.",
    "auth/user-not-found": "Ingen användare med den e-postadressen.",
    "auth/wrong-password": "Fel lösenord.",
    "auth/invalid-credential": "Fel e-post eller lösenord.",
    "auth/too-many-requests": "För många försök. Försök igen senare."
  };
  return errors[code] || "Något gick fel. Försök igen.";
}

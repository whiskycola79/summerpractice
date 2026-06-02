import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, getDocs, query, where,
  orderBy, doc, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
    const snap = await getDoc(doc(db, "users", user.uid));
    currentUser = { uid: user.uid, ...snap.data() };
    document.getElementById("nav-username").textContent = currentUser.name;
    document.getElementById("welcome-name").textContent = currentUser.name;
    document.getElementById("admin-nav-btn").style.display = currentUser.role === "admin" ? "inline-block" : "none";
    showPage("page-main");
    showSection("home");
    loadStats();
    loadHomeHistory();
    loadHomeLeaderboard();
  } else {
    currentUser = null;
    showPage("page-auth");
  }
});

// ─── AUTH ─────────────────────────────────────────────────
window.switchAuth = (tab, btn) => {
  document.querySelectorAll(".auth-tab").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById("auth-login").style.display = tab === "login" ? "flex" : "none";
  document.getElementById("auth-register").style.display = tab === "register" ? "flex" : "none";
  document.getElementById("login-error").textContent = "";
  document.getElementById("reg-error").textContent = "";
};

window.doRegister = async () => {
  const name = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const err = document.getElementById("reg-error");
  err.textContent = "";
  if (!name || !email || !password) { err.textContent = "Fyll i alla fält."; return; }
  if (password.length < 6) { err.textContent = "Lösenordet måste vara minst 6 tecken."; return; }
  try {
    const usersSnap = await getDocs(collection(db, "users"));
    const isFirst = usersSnap.empty;
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    await setDoc(doc(db, "users", cred.user.uid), {
      name, email, role: isFirst ? "admin" : "player",
      totalMinutes: 0, totalSessions: 0, createdAt: serverTimestamp()
    });
  } catch (e) { err.textContent = firebaseError(e.code); }
};

window.doLogin = async () => {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const err = document.getElementById("login-error");
  err.textContent = "";
  if (!email || !password) { err.textContent = "Fyll i e-post och lösenord."; return; }
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) { err.textContent = firebaseError(e.code); }
};

window.doLogout = async () => { await signOut(auth); };

// ─── SKAPA SPELARE (ADMIN) ────────────────────────────────
window.createPlayer = async () => {
  const name = document.getElementById("new-name").value.trim();
  const email = document.getElementById("new-email").value.trim();
  const password = document.getElementById("new-password").value.trim();
  const role = document.getElementById("new-role").value;
  const err = document.getElementById("new-error");
  const succ = document.getElementById("new-success");
  err.textContent = ""; succ.textContent = "";
  if (!name || !email || !password) { err.textContent = "Fyll i alla fält."; return; }
  if (password.length < 4) { err.textContent = "Lösenordet måste vara minst 4 tecken."; return; }
  try {
    const tempAuth = getAuth(initializeApp(firebaseConfig, "temp-" + Date.now()));
    const cred = await createUserWithEmailAndPassword(tempAuth, email, password);
    await updateProfile(cred.user, { displayName: name });
    await setDoc(doc(db, "users", cred.user.uid), {
      name, email, role, totalMinutes: 0, totalSessions: 0, createdAt: serverTimestamp()
    });
    await signOut(tempAuth);
    succ.textContent = `✓ ${name} har skapats!`;
    document.getElementById("new-name").value = "";
    document.getElementById("new-email").value = "";
    document.getElementById("new-password").value = "";
    setTimeout(() => { succ.textContent = ""; }, 3000);
    loadPlayersList();
  } catch (e) { err.textContent = firebaseError(e.code); }
};

// ─── LOGGA TRÄNING ────────────────────────────────────────
window.saveSession = async () => {
  const date = document.getElementById("log-date").value;
  const type = document.getElementById("log-type").value;
  const minutes = parseInt(document.getElementById("log-minutes").value);
  const notes = document.getElementById("log-notes").value.trim();
  const succ = document.getElementById("log-success");
  const err = document.getElementById("log-error");
  succ.textContent = ""; err.textContent = "";
  if (!date) { err.textContent = "Välj ett datum."; return; }
  if (!minutes || minutes < 1) { err.textContent = "Ange antal minuter."; return; }
  try {
    await addDoc(collection(db, "sessions"), {
      userId: currentUser.uid, userName: currentUser.name,
      date, type, minutes, notes, createdAt: serverTimestamp()
    });
    const userRef = doc(db, "users", currentUser.uid);
    const snap = await getDoc(userRef);
    const data = snap.data();
    await setDoc(userRef, {
      ...data,
      totalMinutes: (data.totalMinutes || 0) + minutes,
      totalSessions: (data.totalSessions || 0) + 1
    });
    currentUser.totalMinutes = (currentUser.totalMinutes || 0) + minutes;
    currentUser.totalSessions = (currentUser.totalSessions || 0) + 1;
    succ.textContent = "✓ Träning sparad!";
    document.getElementById("log-minutes").value = "";
    document.getElementById("log-notes").value = "";
    setTimeout(() => { succ.textContent = ""; }, 3000);
    loadStats();
    loadHomeHistory();
  } catch (e) { err.textContent = "Kunde inte spara: " + e.message; }
};

// ─── LOAD FUNCTIONS ───────────────────────────────────────
async function loadStats() {
  const q = query(collection(db, "sessions"), where("userId", "==", currentUser.uid));
  const snap = await getDocs(q);
  const sessions = snap.docs.map(d => d.data());
  document.getElementById("stat-sessions").textContent = sessions.length;
  document.getElementById("stat-minutes").textContent = sessions.reduce((a, s) => a + s.minutes, 0);
  const dates = [...new Set(sessions.map(s => s.date))].sort().reverse();
  let streak = 0, cur = new Date(); cur.setHours(0, 0, 0, 0);
  for (const d of dates) {
    const diff = Math.round((cur - new Date(d)) / 86400000);
    if (diff <= 1) { streak++; cur = new Date(d); } else break;
  }
  document.getElementById("stat-streak").textContent = streak;
}

async function loadHomeHistory() {
  const q = query(collection(db, "sessions"), where("userId", "==", currentUser.uid), orderBy("date", "desc"));
  const snap = await getDocs(q);
  const sessions = snap.docs.map(d => d.data()).slice(0, 3);
  const el = document.getElementById("home-history");
  if (!sessions.length) { el.innerHTML = '<p style="color:#666;font-size:14px;">Inga träningar ännu.</p>'; return; }
  el.innerHTML = sessions.map(s => historyRow(s)).join("");
}

async function loadHomeLeaderboard() {
  const snap = await getDocs(collection(db, "users"));
  const users = snap.docs.map(d => ({ uid: d.id, ...d.data() })).sort((a, b) => (b.totalMinutes || 0) - (a.totalMinutes || 0)).slice(0, 4);
  document.getElementById("home-leaderboard").innerHTML = lbRows(users);
}

async function loadFullHistory() {
  const q = query(collection(db, "sessions"), where("userId", "==", currentUser.uid), orderBy("date", "desc"));
  const snap = await getDocs(q);
  const sessions = snap.docs.map(d => d.data());
  const el = document.getElementById("history-list");
  if (!sessions.length) { el.innerHTML = '<p style="color:#666;font-size:14px;">Inga träningar loggade ännu.</p>'; return; }
  el.innerHTML = sessions.map(s => historyRow(s)).join("");
}

async function loadFullLeaderboard() {
  const snap = await getDocs(collection(db, "users"));
  const users = snap.docs.map(d => ({ uid: d.id, ...d.data() })).sort((a, b) => (b.totalMinutes || 0) - (a.totalMinutes || 0));
  document.getElementById("full-leaderboard").innerHTML = lbRows(users);
}

async function loadPlayersList() {
  const snap = await getDocs(collection(db, "users"));
  const users = snap.docs.map(d => ({ uid: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name));
  const el = document.getElementById("players-list");
  if (!users.length) { el.innerHTML = '<p style="color:#666;font-size:14px;">Inga spelare ännu.</p>'; return; }
  el.innerHTML = users.map(u => `
    <div class="player-row">
      <div class="player-avatar">${u.name.charAt(0).toUpperCase()}</div>
      <div class="player-info">
        <div class="player-name">${u.name}${u.role === "admin" ? '<span class="admin-badge">Admin</span>' : ''}</div>
        <div class="player-email">${u.email}</div>
      </div>
      <div style="text-align:right">
        <div class="player-mins">${u.totalMinutes || 0} min</div>
        <div class="player-sessions">${u.totalSessions || 0} pass</div>
      </div>
    </div>`).join("");
}

// ─── HELPERS ──────────────────────────────────────────────
function historyRow(s) {
  return `<div class="history-item">
    <div class="badge">${s.type.split(" ")[1] || s.type}</div>
    <div class="hi-info"><div class="hi-name">${s.type.substring(2)}</div><div class="hi-date">${fmt(s.date)}${s.notes ? " — " + s.notes : ""}</div></div>
    <div><div class="hi-mins">${s.minutes}</div><div class="hi-mins-lbl">min</div></div>
  </div>`;
}

function lbRows(users) {
  const medals = ["🥇", "🥈", "🥉"];
  if (!users.length) return '<div style="padding:16px;color:#666;font-size:13px;">Inga spelare ännu.</div>';
  return users.map((u, i) => `
    <div class="lb-row" ${u.uid === currentUser.uid ? 'style="background:#1a0508;"' : ''}>
      <div class="lb-rank">${medals[i] || (i + 1) + "."}</div>
      <div class="lb-info"><div class="lb-name">${u.name}${u.uid === currentUser.uid ? " (du)" : ""}</div><div class="lb-detail">${u.totalSessions || 0} pass</div></div>
      <div style="text-align:right"><div class="lb-mins-num">${u.totalMinutes || 0}</div><div class="lb-mins-lbl">min</div></div>
    </div>`).join("");
}

function fmt(d) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
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

// ─── NAV ──────────────────────────────────────────────────
window.switchMain = (id, btn) => {
  document.querySelectorAll(".section-view").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".nba-nav-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("main-" + id).classList.add("active");
  btn.classList.add("active");
  if (id === "historik") loadFullHistory();
  if (id === "topplista") loadFullLeaderboard();
  if (id === "admin") loadPlayersList();
  if (id === "log") document.getElementById("log-date").value = new Date().toISOString().split("T")[0];
};

function showPage(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function showSection(id) {
  document.querySelectorAll(".section-view").forEach(s => s.classList.remove("active"));
  document.getElementById("main-" + id).classList.add("active");
  document.getElementById("log-date").value = new Date().toISOString().split("T")[0];
}

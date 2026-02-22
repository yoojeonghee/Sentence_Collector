import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, deleteDoc, updateDoc, doc, query, orderBy, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyAWEFJXr9pedEiGYREg_vakG4tCayFnjno",
  authDomain: "my-sentence-collector.firebaseapp.com",
  projectId: "my-sentence-collector",
  storageBucket: "my-sentence-collector.firebasestorage.app",
  messagingSenderId: "269081698623",
  appId: "1:269081698623:web:1319e30e3a292081bb338a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// ✅ [추가] 로그인 버튼을 누를 때마다 계정 선택창 띄우기 설정
// provider.setCustomParameters({
//   prompt: 'select_account'
// });

let rawRecords = [];
let editingId = null;
let currentUser = null;
let unsubscribe = null;

const cardsContainer = document.getElementById("cards");
const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");

// =============================
// 🔐 로그인/아웃 로직
// =============================

document.getElementById("google-login-btn").onclick = async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.error("로그인 실패:", err);
    alert("로그인에 실패했습니다.");
  }
};

document.getElementById("logoutBtn").onclick = async () => {
  await signOut(auth);
};

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    loginScreen.style.display = "none";
    appScreen.style.display = "block";
    startRealtimeListener();
  } else {
    currentUser = null;
    loginScreen.style.display = "flex";
    appScreen.style.display = "none";
    cardsContainer.innerHTML = "";
    if (unsubscribe) unsubscribe();
  }
});

// =============================
// 🔥 데이터 처리 로직
// =============================

function startRealtimeListener() {
  if (unsubscribe) unsubscribe();
  const q = query(
    collection(db, "users", currentUser.uid, "records"),
    orderBy("createdAt", "desc")
  );
  unsubscribe = onSnapshot(q, (snapshot) => {
    rawRecords = [];
    snapshot.forEach(docItem => {
      rawRecords.push({ firebaseId: docItem.id, ...docItem.data() });
    });
    render();
  });
}

async function saveRecord() {
  const title = document.getElementById("title").value.trim();
  const author = document.getElementById("author").value.trim();
  const content = document.getElementById("content").value.trim();
  if (!title || !content) return alert("제목과 내용을 입력해주세요.");

  // ✅ 데이터 저장 시 날짜는 자동으로 저장되고 있습니다. (date 항목)
  await addDoc(collection(db, "users", currentUser.uid, "records"), {
    title, author, content,
    date: new Date().toLocaleDateString(),
    createdAt: new Date()
  });
  clearInputs();
}

window.deleteSentence = async function(firebaseId) {
  if(confirm("정말 삭제하시겠습니까?")) {
    await deleteDoc(doc(db, "users", currentUser.uid, "records", firebaseId));
  }
};

window.editSentence = function(firebaseId) {
  const record = rawRecords.find(r => r.firebaseId === firebaseId);
  if (!record) return;
  editingId = firebaseId;
  document.getElementById("title").value = record.title;
  document.getElementById("author").value = record.author;
  document.getElementById("content").value = record.content;
  window.scrollTo({ top: 0, behavior: "smooth" });
};

async function updateEdited() {
  await updateDoc(doc(db, "users", currentUser.uid, "records", editingId), {
    title: document.getElementById("title").value.trim(),
    author: document.getElementById("author").value.trim(),
    content: document.getElementById("content").value.trim()
  });
  editingId = null;
  clearInputs();
}

// =============================
// 🎨 화면 렌더링
// =============================

function render() {
  cardsContainer.innerHTML = "";
  const grouped = {};
  rawRecords.forEach(r => {
    const key = r.title + "__" + r.author;
    if (!grouped[key]) grouped[key] = { title: r.title, author: r.author, sentences: [] };
    grouped[key].sentences.push(r);
  });

  Object.values(grouped).forEach((group, i) => {
    const card = document.createElement("div");
    card.className = "card";
    card.style.animationDelay = `${i * 80}ms`;
    card.innerHTML = `
      <h3>${group.title}</h3>
      <small>${group.author || ""}</small>
      <div class="sentences" style="display:none; flex-direction:column; gap:14px; margin-top:18px;">
        ${group.sentences.map(s => `
          <div class="sentence-item" style="padding: 16px; background: var(--bg); border-radius: 18px;">
            <div style="margin-bottom: 12px; line-height: 1.6;">${s.content}</div>
            
            <div style="border-top: 1px solid var(--line); padding-top: 12px; margin-top: 4px; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; color: var(--sub); opacity: 0.8;">${s.date || ''}</span>
              <div class="sentence-actions" style="opacity: 1; display: flex; gap: 8px;">
                <button onclick="editSentence('${s.firebaseId}')" style="padding: 4px 8px; font-size: 12px; background: none; box-shadow: none; color: var(--text);">✏️</button>
                <button onclick="deleteSentence('${s.firebaseId}')" style="padding: 4px 8px; font-size: 12px; background: none; box-shadow: none; color: var(--text);">🗑</button>
              </div>
            </div>
          </div>
        `).join("")}
      </div>
    `;
    card.addEventListener("click", (e) => {
      if (e.target.closest(".sentence-actions")) return;
      const list = card.querySelector(".sentences");
      list.style.display = list.style.display === "flex" ? "none" : "flex";
    });
    cardsContainer.appendChild(card);
  });
}

function clearInputs() {
  document.getElementById("title").value = "";
  document.getElementById("author").value = "";
  document.getElementById("content").value = "";
}

document.querySelector(".save-btn").addEventListener("click", () => {
  if (editingId) updateEdited();
  else saveRecord();
});

document.getElementById("themeToggle").onclick = () => {
    document.body.classList.toggle("dark");
    const isDark = document.body.classList.contains("dark");
    document.getElementById("themeToggle").innerText = isDark ? "☀️" : "🌙";
};
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

// ✅ [수정] 로그인 버튼을 누를 때마다 항상 계정 선택창 띄우기
provider.setCustomParameters({
  prompt: 'select_account'
});

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

// ✅ [추가] 클립보드 복사 함수
window.copyText = (text) => {
  navigator.clipboard.writeText(text).then(() => {
    const toast = document.createElement("div");
    toast.className = "copy-toast";
    toast.innerText = "문장이 복사되었습니다 ✨";
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 500);
    }, 2000);
  });
};

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
      <div class="card-header">
        <h3 style="transition: color 0.3s;">${group.title}</h3>
        <small>${group.author || "저자 미상"}</small>
      </div>

      <div class="sentences">
        ${group.sentences.map(s => {
          const safeContent = s.content.replace(/'/g, "\\'").replace(/"/g, '&quot;');
          return `
            <div class="sentence-item" onclick="event.stopPropagation(); copyText('${safeContent}')">
              <div class="sentence-content" style="word-break: break-all;">${s.content}</div>
              <div class="sentence-footer">
                <span>${s.date || ''}</span>
                <div class="sentence-actions">
                  <button onclick="event.stopPropagation(); editSentence('${s.firebaseId}')">✏️</button>
                  <button onclick="event.stopPropagation(); deleteSentence('${s.firebaseId}')">🗑</button>
                </div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;

    card.addEventListener("click", (e) => {
      // 버튼 클릭 시에는 이미 stopPropagation이 있어서 작동하지 않지만, 한 번 더 체크
      if (e.target.closest(".sentence-actions")) return;
      
      const list = card.querySelector(".sentences");
      const title = card.querySelector("h3");
      const isOpen = list.classList.contains("active");

      if (isOpen) {
        list.classList.remove("active");
        title.style.color = "var(--text-main)";
      } else {
        list.classList.add("active");
        title.style.color = "var(--text-sub)";
      }
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
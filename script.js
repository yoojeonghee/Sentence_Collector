import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, deleteDoc, updateDoc, doc,
  query, orderBy, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getAuth, signInWithPopup, GoogleAuthProvider,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// =============================
// 🔥 Firebase 설정
// =============================

const firebaseConfig = {
  apiKey: "AIzaSyAWEFJXr9pedEiGYREg_vakG4tCayFnjno",
  authDomain: "my-sentence-collector.firebaseapp.com",
  projectId: "my-sentence-collector",
  storageBucket: "my-sentence-collector.firebasestorage.app",
  messagingSenderId: "269081698623",
  appId: "1:269081698623:web:1319e30e3a292081bb338a",
  measurementId: "G-5V6WXVBHV6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

// =============================
// 📦 전역 변수
// =============================

let rawRecords = [];
let editingId = null;
let currentUser = null;
let unsubscribeData = null;
let unsubscribeCount = null;

const cardsContainer = document.getElementById("cards");
const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");

// =============================
// 🔢 숫자 애니메이션
// =============================

function animateCount(element, start, end, duration = 700) {
  let startTime = null;

  function update(currentTime) {
    if (!startTime) startTime = currentTime;
    const progress = currentTime - startTime;
    const percent = Math.min(progress / duration, 1);

    const value = Math.floor(start + (end - start) * percent);
    element.innerText = value;

    if (percent < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

// =============================
// 🎉 축하 효과
// =============================

function celebrateNumber(element) {
  element.classList.add("celebrate");

  const sparkle = document.createElement("span");
  sparkle.className = "sparkle";
  sparkle.innerText = "✨";

  element.after(sparkle);

  setTimeout(() => {
    element.classList.remove("celebrate");
    sparkle.remove();
  }, 1000);
}

// =============================
// 🔐 로그인
// =============================

document.getElementById("google-login-btn").onclick = async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    alert("로그인 실패");
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
    startCountListener();
  } else {
    currentUser = null;
    loginScreen.style.display = "flex";
    appScreen.style.display = "none";
    cardsContainer.innerHTML = "";

    if (unsubscribeData) unsubscribeData();
    if (unsubscribeCount) unsubscribeCount();
  }
});

// =============================
// 🔥 오늘 기록 수 리스너
// =============================

function startCountListener() {
  if (unsubscribeCount) unsubscribeCount();

  const q = query(
    collection(db, "users", currentUser.uid, "records"),
    orderBy("createdAt", "desc")
  );

  unsubscribeCount = onSnapshot(q, (snapshot) => {
    let todayCount = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    snapshot.forEach(docItem => {
      const data = docItem.data();
      if (!data.createdAt) return;

      const created = data.createdAt.toDate
        ? data.createdAt.toDate()
        : new Date(data.createdAt);

      if (created >= today) todayCount++;
    });

    updateTodayUI(todayCount);
  });
}

// =============================
// 🌿 오늘 UI 업데이트
// =============================

function updateTodayUI(todayCount) {
  const messageElements = document.querySelectorAll(".todayMessage");
  const subElements = document.querySelectorAll(".todaySub");

  messageElements.forEach((el, index) => {
    const subEl = subElements[index];

    if (todayCount === 0) {
      el.innerText = "오늘 아직 기록이 없어요.";
      subEl.innerText = "첫 문장을 기다리고 있어요.";
    }

    else if (todayCount === 1) {
      el.innerText = "오늘 첫 문장이 기록되었어요.";
      subEl.innerText = "좋은 시작이에요.";
    }

    else {
      el.innerHTML = `
        오늘 <span class="todayNumber">0</span>개의 문장이 기록되었어요.
      `;

      const numberEl = el.querySelector(".todayNumber");
      animateCount(numberEl, 0, todayCount, 700);

      subEl.innerText = "차곡차곡 쌓이고 있어요.";

      // 🎯 마일스톤 조건
      let shouldCelebrate = false;

      if (todayCount >= 10 && todayCount < 100 && todayCount % 10 === 0)
        shouldCelebrate = true;

      else if (todayCount >= 100 && todayCount < 1000 && todayCount % 100 === 0)
        shouldCelebrate = true;

      else if (todayCount >= 1000 && todayCount % 1000 === 0)
        shouldCelebrate = true;

      if (shouldCelebrate) {
        subEl.innerText = "기록이 습관이 되고 있어요.";
        setTimeout(() => {
          celebrateNumber(numberEl);
        }, 700);
      }
    }
  });
}

// =============================
// 📚 데이터 리스너
// =============================

function startRealtimeListener() {
  if (unsubscribeData) unsubscribeData();

  const q = query(
    collection(db, "users", currentUser.uid, "records"),
    orderBy("createdAt", "desc")
  );

  unsubscribeData = onSnapshot(q, (snapshot) => {
    rawRecords = [];
    snapshot.forEach(docItem => {
      rawRecords.push({ firebaseId: docItem.id, ...docItem.data() });
    });
    render();
  });
}

// =============================
// ✍ 저장 / 수정
// =============================

async function saveRecord() {
  const title = document.getElementById("title").value.trim();
  const author = document.getElementById("author").value.trim();
  const content = document.getElementById("content").value.trim();

  if (!title || !content) {
    alert("제목과 내용을 입력해주세요.");
    return;
  }

  await addDoc(collection(db, "users", currentUser.uid, "records"), {
    title,
    author,
    content,
    date: new Date().toLocaleDateString(),
    createdAt: new Date()
  });

  clearInputs();
}

async function updateEdited() {
  await updateDoc(
    doc(db, "users", currentUser.uid, "records", editingId),
    {
      title: document.getElementById("title").value.trim(),
      author: document.getElementById("author").value.trim(),
      content: document.getElementById("content").value.trim()
    }
  );

  editingId = null;
  clearInputs();
}

// =============================
// 🗑 삭제
// =============================

window.deleteSentence = async function(firebaseId) {
  if (confirm("정말 삭제하시겠습니까?")) {
    await deleteDoc(
      doc(db, "users", currentUser.uid, "records", firebaseId)
    );
  }
};

// =============================
// 🎨 렌더링
// =============================

function render() {
  cardsContainer.innerHTML = "";

  rawRecords.forEach((r, i) => {
    const card = document.createElement("div");
    card.className = "card";
    card.style.animationDelay = `${i * 60}ms`;

    card.innerHTML = `
      <h3>${r.title}</h3>
      <p>${r.content}</p>
      <small>${r.author || "저자 미상"} · ${r.date || ""}</small>
    `;

    cardsContainer.appendChild(card);
  });
}

// =============================
// 기타
// =============================

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
};
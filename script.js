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
  const user = auth.currentUser;
  if (!user) {
    alert("로그인이 필요합니다.");
    return;
  }

  const title = document.getElementById("title").value.trim();
  const author = document.getElementById("author").value.trim();
  const content = document.getElementById("content").value.trim();

  if (!title || !content) {
    alert("제목과 내용을 입력해주세요.");
    return;
  }

  await addDoc(collection(db, "users", user.uid, "records"), {
    title,
    author,
    content,
    date: new Date().toLocaleDateString(),
    createdAt: new Date()
  });

  clearInputs();
}

// =============================
// 📝 수정 모드 진입 (여기에 추가!)
// =============================
window.editSentence = function(id, title, author, content) {
  document.getElementById("title").value = title;
  document.getElementById("author").value = author;
  document.getElementById("content").value = content;

  editingId = id; // 수정 중인 문서의 ID 저장

  // 화면 상단 입력창으로 부드럽게 이동
  window.scrollTo({ top: 0, behavior: 'smooth' });

  const saveBtn = document.querySelector(".save-btn");
  if (saveBtn) saveBtn.innerText = "수정 완료";
  
  document.getElementById("title").focus();
};

// ... 나머지 코드 ...

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

  const saveBtn = document.querySelector(".save-btn");
  if (saveBtn) saveBtn.innerText = "저장";

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
// =============================
// 🎨 렌더링 (그룹화 + 점 개수 표시 + 수정/삭제 포함)
// =============================
function render() {
  cardsContainer.innerHTML = "";

  // 1. 데이터 그룹화 (제목 + 저자 기준)
  const grouped = rawRecords.reduce((acc, curr) => {
    const key = `${curr.title}_${curr.author || "저자 미상"}`;
    if (!acc[key]) {
      acc[key] = {
        title: curr.title,
        author: curr.author || "저자 미상",
        sentences: []
      };
    }
    acc[key].sentences.push(curr);
    return acc;
  }, {});

  // 2. 그룹화된 데이터를 화면에 출력
  Object.values(grouped).forEach((group, i) => {
    const card = document.createElement("div");
    card.className = "card";
    card.style.animationDelay = `${i * 60}ms`;

    // 🔥 숫자를 빼고 문장 개수만큼 점(·) 생성
    // 1개일 때는 안 나오고, 2개 이상부터 문장 수만큼 점이 생깁니다.
    const dots = "·".repeat(group.sentences.length);
    const countBadge = group.sentences.length > 1 
      ? `<span class="count-dots">${dots}</span>` 
      : "";

    card.innerHTML = `
      <div class="card-header">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3>${group.title} ${countBadge}</h3>
        </div>
        <small>${group.author}</small>
      </div>
      
      <div class="sentences">
        ${group.sentences.map(s => `
          <div class="sentence-item" onclick="event.stopPropagation(); copyToClipboard(\`${s.content.replace(/`/g, '\\`').replace(/\n/g, '\\n')}\`)">
            <p>${s.content}</p>
            <div class="sentence-footer">
              <small>${s.date}</small>
              <div class="sentence-actions">
                <button onclick="event.stopPropagation(); editSentence('${s.firebaseId}', '${s.title.replace(/'/g, "\\'")}', '${s.author.replace(/'/g, "\\'")}', \`${s.content.replace(/`/g, '\\`')}\`)">수정</button>
                <button onclick="event.stopPropagation(); deleteSentence('${s.firebaseId}')">삭제</button>
              </div>
            </div>
          </div>
        `).join("")}
      </div>
    `;

    // 3. 카드 클릭 이벤트: 문장 목록 펼치기/접기
    card.onclick = () => {
      const sentencesDiv = card.querySelector(".sentences");
      const isActive = sentencesDiv.classList.contains("active");
      
      if (isActive) {
        sentencesDiv.classList.remove("active");
        sentencesDiv.style.display = "none";
      } else {
        sentencesDiv.classList.add("active");
        sentencesDiv.style.display = "flex";
      }
    };

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

  editingId = null;

  const saveBtn = document.querySelector(".save-btn");
  if (saveBtn) saveBtn.innerText = "저장";
}

document.querySelector(".save-btn").addEventListener("click", () => {
  if (editingId) updateEdited();
  else saveRecord();
});

const loginThemeBtn = document.getElementById("loginThemeToggle");
const mainThemeBtn = document.getElementById("themeToggle");

function updateThemeIcons(isLight) {
  const icon = isLight ? "🌙" : "☀️";
  if (loginThemeBtn) loginThemeBtn.innerText = icon;
  if (mainThemeBtn) mainThemeBtn.innerText = icon;
}

function handleThemeToggle() {
  document.body.classList.toggle("light");
  const isLight = document.body.classList.contains("light");
  
  // 로컬 스토리지 등에 저장하고 싶다면 여기에 추가
  updateThemeIcons(isLight);
}

// 클릭 이벤트 연결
if (loginThemeBtn) loginThemeBtn.onclick = handleThemeToggle;
if (mainThemeBtn) mainThemeBtn.onclick = handleThemeToggle;

// =============================
// 📋 문장 복사 기능
// =============================
window.copyToClipboard = function(text) {
  navigator.clipboard.writeText(text).then(() => {
    // 복사 성공 시 토스트 알림 표시
    const toast = document.createElement("div");
    toast.className = "copy-toast";
    toast.innerText = "문장이 복사되었습니다.";
    document.body.appendChild(toast);

    // 2초 후 토스트 제거
    setTimeout(() => {
      toast.remove();
    }, 2000);
  }).catch(err => {
    console.error("복사 실패:", err);
  });
};
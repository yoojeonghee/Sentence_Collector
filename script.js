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
let searchTerm = ""; // 검색어를 저장할 변수
let isFavoriteFilterActive = false;
let dailySentenceData = null; // 오늘의 문장 변수
let currentDailySentence = null;
let expandedCardKeys = new Set(); // ⭐ 열려 있는 카드의 키(제목+저자)를 저장할 세트 추가

const cardsContainer = document.getElementById("cards");
const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");

// 추가: X 버튼 요소를 미리 가져옵니다.
const searchInput = document.getElementById("searchInput");
const searchClear = document.getElementById("searchClear");

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
    // 오늘의 문장도 함께 로드
    loadDailySentence();
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
  const location = document.getElementById("location").value.trim();
  const content = document.getElementById("content").value.trim();

  if (!title || !content) {
    alert("제목과 내용을 입력해주세요.");
    return;
  }

  await addDoc(collection(db, "users", user.uid, "records"), {
    title,
    author,
    location,
    content,
    date: new Date().toLocaleDateString(),
    createdAt: new Date()
  });

  clearInputs();
}

// =============================
// ➕ 기존 책에 문장 추가 기능 (새로 추가할 부분)
// =============================
window.addMoreFromBook = function(title, author) {
  // 1. 입력창에 제목과 저자 정보를 자동으로 넣습니다.
  document.getElementById("title").value = title;
  document.getElementById("author").value = author;
  
  // 2. 다른 입력 칸(내용, 위치)은 비워줍니다.
  document.getElementById("content").value = "";
  document.getElementById("location").value = "";
  
  // 3. 화면을 맨 위(입력창)로 부드럽게 올립니다.
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  // 4. 바로 내용을 입력할 수 있게 '내용' 입력창에 커서를 둡니다.
  document.getElementById("content").focus();
  
  // 5. 버튼 이름을 '저장'으로 확인 (수정 모드였다면 되돌림)
  const saveBtn = document.querySelector(".save-btn");
  if (saveBtn) saveBtn.innerText = "저장";
  editingId = null;
};

// =============================
// 📝 수정 모드 진입 (여기에 추가!)
// =============================
window.editSentence = function(id, title, author, location, content) {
  document.getElementById("title").value = title;
  document.getElementById("author").value = author;
  document.getElementById("content").value = content;

  // 위치 데이터가 있으면 입력창을 보여주고 값을 넣음
  if (location && location.trim() !== "") {
    locationInput.style.display = "block";
    locationBtn.innerHTML = "<span>✕</span> 위치 입력 닫기";
    locationInput.value = location;
  } else {
    locationInput.style.display = "none";
    locationBtn.innerHTML = "<span>+</span> 위치 입력 추가";
    locationInput.value = "";
  }

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
      location: document.getElementById("location").value.trim(),
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
// ⭐ 즐겨찾기 토글 (Firestore 업데이트)
// =============================
window.toggleFavorite = async function(firebaseId, currentStatus) {
  const newStatus = !currentStatus;
  
  await updateDoc(doc(db, "users", currentUser.uid, "records", firebaseId), {
    isFavorite: newStatus
  });

  // 토스트 알림 (기존 copy-toast 스타일 재활용)
  const toast = document.createElement("div");
  toast.className = "copy-toast";
  toast.innerText = newStatus ? "⭐ 나의 문장집에 추가되었습니다." : "즐겨찾기 해제";
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
};

// =============================
// ✨ 하이라이트 보조 함수 (추가)
// =============================
function highlightText(text, query) {
  if (!query) return text; // 검색어가 없으면 원본 그대로 반환
  
  // 검색어에 특수문자가 섞여있을 경우를 대비해 이스케이프 처리
  const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${safeQuery})`, "gi");
  
  // 검색어와 일치하는 부분을 <mark> 태그로 감싸서 반환
  return text.replace(re, "<mark>$1</mark>");
}

// =============================
// 🎨 렌더링
// =============================
function render() {
  cardsContainer.innerHTML = "";

  // ✨ 추가: 검색어에 맞는 데이터만 필터링
  const filteredRecords = rawRecords.filter(record => {
    const matchesSearch = 
      record.title.toLowerCase().includes(searchTerm) ||
      (record.author && record.author.toLowerCase().includes(searchTerm)) ||
      record.content.toLowerCase().includes(searchTerm);
    
    // 즐겨찾기 필터가 켜져 있으면 isFavorite이 true인 것만 보여줌
    const matchesFavorite = isFavoriteFilterActive ? record.isFavorite === true : true;

    return matchesSearch && matchesFavorite;
  });

  // 1. 데이터 그룹화 (제목 + 저자 기준)
  const grouped = filteredRecords.reduce((acc, curr) => {
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
  // [render() 함수 내부 Object.values(grouped).forEach 루프 안쪽 수정]
  Object.values(grouped).forEach((group, i) => {
    const key = `${group.title}_${group.author}`; // 카드 고유 키
    const isExpanded = expandedCardKeys.has(key); // ⭐ 이 카드가 열려 있었는지 확인

    const card = document.createElement("div");
    card.className = "card";
    card.style.animationDelay = `${i * 60}ms`;

    const dots = "·".repeat(group.sentences.length);
    const countBadge = group.sentences.length > 1 ? `<span class="count-dots">${dots}</span>` : "";

    card.innerHTML = `
      <div class="card-header">
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
          <div>
            <h3>${highlightText(group.title, searchTerm)} ${countBadge}</h3>
            <small>${highlightText(group.author, searchTerm)}</small>
          </div>
          <button class="add-more-btn" onclick="event.stopPropagation(); addMoreFromBook('${group.title.replace(/'/g, "\\'")}', '${group.author.replace(/'/g, "\\'")}')">
            ＋
          </button>
        </div>
      </div>
      
      <div class="sentences ${isExpanded ? 'active' : ''}" style="display: ${isExpanded ? 'flex' : 'none'};">
        ${group.sentences.map(s => `
          <div class="sentence-item" onclick="event.stopPropagation(); copyToClipboard(\`${s.content.replace(/`/g, '\\`')}\`)">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
              <p style="flex:1;">${highlightText(s.content, searchTerm)}</p>
              <span class="favorite-star" 
                    style="cursor:pointer; font-size:1.2rem; color:${s.isFavorite ? '#FFD700' : '#ccc'};"
                    onclick="event.stopPropagation(); toggleFavorite('${s.firebaseId}', ${s.isFavorite || false})">
                ${s.isFavorite ? '★' : '☆'}
              </span>
            </div>

            <div class="sentence-footer">
              <div class="sentence-meta">
                <span>${s.date || ''}</span>
                ${s.location ? `<span style="margin-left:8px; opacity:0.8;">| ${highlightText(s.location, searchTerm)}</span>` : ''}
              </div>
              <div class="sentence-actions">
                <button onclick="event.stopPropagation(); editSentence('${s.firebaseId}', '${s.title.replace(/'/g, "\\'")}', '${s.author.replace(/'/g, "\\'")}', '${(s.location || "").replace(/'/g, "\\'")}', \`${s.content.replace(/`/g, '\\`')}\`)">수정</button>
                <button onclick="event.stopPropagation(); deleteSentence('${s.firebaseId}')">삭제</button>
              </div>
            </div>
          </div>
        `).join("")}
      </div>
    `;

    // 3. 카드 클릭 이벤트 수정
    card.onclick = () => {
      const sentencesDiv = card.querySelector(".sentences");
      const isActive = sentencesDiv.classList.contains("active");
      
      if (isActive) {
        sentencesDiv.classList.remove("active");
        sentencesDiv.style.display = "none";
        expandedCardKeys.delete(key); // ⭐ 닫으면 세트에서 제거
      } else {
        sentencesDiv.classList.add("active");
        sentencesDiv.style.display = "flex";
        expandedCardKeys.add(key); // ⭐ 열면 세트에 추가
      }
    };

    cardsContainer.appendChild(card);
  });

  // ✨ 검색 결과가 없을 때 안내 메시지 출력
  if (filteredRecords.length === 0) {
    const noResult = document.createElement("div");
    noResult.style.textAlign = "center";
    noResult.style.padding = "40px 0";
    noResult.style.color = "#888";
    noResult.style.fontSize = "0.9rem";
    noResult.innerHTML = `
      <div style="font-size: 2rem; margin-bottom: 10px;">🧐</div>
      찾으시는 문장이 없어요.
    `;
    cardsContainer.appendChild(noResult);
  }
}

// =============================
// 기타
// =============================

function clearInputs() {
  document.getElementById("title").value = "";
  document.getElementById("author").value = "";
  document.getElementById("location").value = "";
  document.getElementById("content").value = "";

  // 입력창 다시 숨기기
  locationInput.style.display = "none";
  locationBtn.innerHTML = "<span>+</span> 위치 입력 추가";

  editingId = null;

  const saveBtn = document.querySelector(".save-btn");
  if (saveBtn) saveBtn.innerText = "저장";
}

// =============================
// 📅 오늘 날짜 문자열 생성
// =============================
function getTodayKey() {
  const today = new Date();
  return today.getFullYear() + "-" +
         (today.getMonth() + 1) + "-" +
         today.getDate();
}

// =============================
// 🎲 랜덤 문장 선택
// =============================
function pickRandomSentence(forceNew = false) {

  if (!rawRecords.length) return null;

  let candidateRecords = rawRecords;

  // 📄 버튼 눌렀을 때는 현재 문장 제외
  if (forceNew && currentDailySentence) {

    candidateRecords = rawRecords.filter(record => 
      record.content !== currentDailySentence.content
    );

    // 문장이 1개뿐이면 그냥 그대로 사용
    if (candidateRecords.length === 0) {
      candidateRecords = rawRecords;
    }
  }

  const randomIndex = Math.floor(Math.random() * candidateRecords.length);
  const selected = candidateRecords[randomIndex];

  currentDailySentence = selected;

  return selected;  // 🔥 이거 꼭 필요함
}

// =============================
// 🌿 오늘의 문장 로드
// =============================
function loadDailySentence(forceNew = false) {

  if (!rawRecords.length) {
    const textEl = document.getElementById("dailySentenceText");
    const metaEl = document.getElementById("dailySentenceMeta");
    const goBtn = document.getElementById("goToInputBtn");

    if (textEl) {
      textEl.innerText = "오늘의 문장이 아직 비어있어요.\n\n당신의 첫 문장을 기록해보세요.";
    }

    if (metaEl) metaEl.innerText = "";

    if (goBtn) goBtn.style.display = "inline-block";

    return;
  }

  const todayKey = getTodayKey();
  const saved = localStorage.getItem("dailySentence");

  if (saved && !forceNew) {
    const parsed = JSON.parse(saved);

    // 오늘 날짜면 그대로 유지
    if (parsed.date === todayKey) {
      dailySentenceData = parsed.data;
      currentDailySentence = parsed.data;
      renderDailySentence();
      return;
    }
  }

  // 새로 뽑기
  const randomSentence = pickRandomSentence(forceNew);
  dailySentenceData = randomSentence;

  localStorage.setItem("dailySentence", JSON.stringify({
    date: todayKey,
    data: randomSentence
  }));

  renderDailySentence();
}

// =============================
// 🔁 오늘의 문장 버튼 클릭 함수
// =============================
window.handleChangeSentence = function() {

  // 문장이 하나도 없으면 아무것도 하지 않음
  if (!rawRecords.length) return;

  // 강제로 새 문장 뽑기
  loadDailySentence(true);

};

// =============================
// 🖼 오늘의 문장 렌더링
// =============================
function renderDailySentence() {
  if (!dailySentenceData) return;

  const textEl = document.getElementById("dailySentenceText");
  const metaEl = document.getElementById("dailySentenceMeta");

  textEl.innerText = dailySentenceData.content;
  metaEl.innerText = `— ${dailySentenceData.title}${dailySentenceData.author ? " | " + dailySentenceData.author : ""}`;
}

// =============================
// 🔍 검색창 로직 (수정 및 추가)
// =============================

// 초기 로드 시 X 버튼 숨기기 (안전장치)
if (searchClear) searchClear.style.display = "none";

// 1. 입력 시: 검색 실행 및 X 버튼 노출 제어
searchInput.addEventListener("input", (e) => {
  searchTerm = e.target.value.toLowerCase().trim();
  
  // 🔥 수정: 글자가 있으면 보여주고, 없으면 완전히 숨김
  if (searchTerm.length > 0) {
    searchClear.style.display = "flex";
  } else {
    searchClear.style.display = "none";
  }
  
  render(); 
});

// 2. X 버튼 클릭 시: 검색어 초기화 및 버튼 숨기기
searchClear.addEventListener("click", () => {
  searchInput.value = "";
  searchTerm = "";
  searchClear.style.display = "none"; // 버튼 숨기기
  searchInput.focus();               // 다시 입력할 수 있게 포커스
  render();                          // 전체 목록 다시 그리기 (검색 해제)
});

// =============================

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

// 입력 필드 위치 추가
const locationBtn = document.getElementById("location-toggle-btn");
const locationInput = document.getElementById("location");

locationBtn.onclick = () => {
  const isHidden = locationInput.style.display === "none" || locationInput.style.display === "";
  
  if (isHidden) {
    locationInput.style.display = "block";
    locationBtn.innerHTML = "<span>✕</span> 위치 입력 닫기";
    locationBtn.classList.add("active");
  } else {
    locationInput.style.display = "none";
    locationBtn.innerHTML = "<span>+</span> 위치 입력 추가";
    locationBtn.classList.remove("active");
    locationInput.value = "";
  }
};

// =============================
// 📚 즐겨찾기 필터 버튼 로직
// =============================
const favoriteFilterBtn = document.getElementById("favoriteFilterBtn");

favoriteFilterBtn.onclick = () => {
  isFavoriteFilterActive = !isFavoriteFilterActive;
  
  // 버튼 활성화 시 시각적 변화 (옵션)
  if (isFavoriteFilterActive) {
    favoriteFilterBtn.style.background = "#fff9c4"; // 노란색 배경
    favoriteFilterBtn.innerText = "⭐";
  } else {
    favoriteFilterBtn.style.background = ""; 
    favoriteFilterBtn.innerText = "📚";
  }
  
  render(); // 리스트 새로고침
};
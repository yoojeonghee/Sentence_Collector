let rawRecords = JSON.parse(localStorage.getItem("records")) || [];
let editingId = null;

const cardsContainer = document.getElementById("cards");

function saveLocal(){
  localStorage.setItem("records", JSON.stringify(rawRecords));
}

function saveRecord(){
  const title=document.getElementById("title").value.trim();
  const author=document.getElementById("author").value.trim();
  const content=document.getElementById("content").value.trim();
  if(!title||!content) return;

  rawRecords.unshift({
    id:Date.now(),
    title,
    author,
    content,
    date:new Date().toLocaleDateString()
  });

  saveLocal();
  render();
  document.getElementById("title").value="";
  document.getElementById("author").value="";
  document.getElementById("content").value="";
}

/* 그룹화 */
function groupRecords(){
  const grouped={};

  rawRecords.forEach(r=>{
    const key=r.title+"__"+r.author;
    if(!grouped[key]){
      grouped[key]={
        title:r.title,
        author:r.author,
        sentences:[]
      };
    }
    grouped[key].sentences.push(r);
  });

  return Object.values(grouped);
}

/* 삭제 */
function deleteSentence(id){
  rawRecords = rawRecords.filter(r=>r.id!==id);
  saveLocal();
  render();
}

/* 수정 */
function editSentence(id){
  const record = rawRecords.find(r=>r.id===id);
  if(!record) return;

  editingId = id;

  document.getElementById("title").value = record.title;
  document.getElementById("author").value = record.author;
  document.getElementById("content").value = record.content;

  window.scrollTo({top:0, behavior:"smooth"});
}

/* 수정 완료 */
function updateEdited(){
  if(!editingId) return;

  const record = rawRecords.find(r=>r.id===editingId);
  record.title = document.getElementById("title").value.trim();
  record.author = document.getElementById("author").value.trim();
  record.content = document.getElementById("content").value.trim();

  editingId = null;
  saveLocal();
  render();

  document.getElementById("title").value="";
  document.getElementById("author").value="";
  document.getElementById("content").value="";
}

/* 저장 버튼이 수정 모드인지 확인 */
document.querySelector(".save-btn").addEventListener("click",()=>{
  if(editingId){
    updateEdited();
  }else{
    saveRecord();
  }
});

function render(){
  cardsContainer.innerHTML="";
  const groups=groupRecords();

  groups.forEach((group,i)=>{
    const card=document.createElement("div");
    card.className="card";
    card.style.animationDelay=`${i*80}ms`;

    card.innerHTML=`
      <h3>${group.title}</h3>
      <small>${group.author||""}</small>
      <div class="sentences">
        ${group.sentences.map(s=>`
          <div class="sentence-item">
            ${s.content}
            <div class="sentence-actions">
              <button onclick="editSentence(${s.id})">✏️</button>
              <button onclick="deleteSentence(${s.id})">🗑</button>
            </div>
          </div>
        `).join("")}
      </div>
    `;

    card.addEventListener("click",(e)=>{
      if(e.target.closest(".sentence-actions")) return;
      const list=card.querySelector(".sentences");
      list.style.display=list.style.display==="flex"?"none":"flex";
    });

    cardsContainer.appendChild(card);
  });
}

/* 다크모드 */
const toggle=document.getElementById("themeToggle");
toggle.onclick=()=>{
  document.body.classList.toggle("dark");
  localStorage.setItem("theme",
    document.body.classList.contains("dark")?"dark":"light"
  );
};

if(localStorage.getItem("theme")==="dark"){
  document.body.classList.add("dark");
}

render();
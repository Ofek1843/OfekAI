const demoCache = new Map();
const esc = (value="") => String(value).replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char]);
let dialog;

function ensureDialog() {
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.className = "exercise-demo-dialog";
  dialog.innerHTML = `<div class="demo-shell"><button class="demo-close" type="button" aria-label="Close">×</button><div class="demo-content"></div></div>`;
  document.body.append(dialog);
  dialog.querySelector(".demo-close").addEventListener("click",()=>dialog.close());
  dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close();});
  return dialog;
}
async function loadDemo(name) {
  const key=name.toLowerCase().trim();
  if(demoCache.has(key))return demoCache.get(key);
  const response=await fetch(`/api/exercise-demo?name=${encodeURIComponent(name)}`),data=await response.json();
  if(!response.ok)throw new Error(data.error||"No demonstration was found.");
  demoCache.set(key,data);return data;
}
async function openDemo(name) {
  const modal=ensureDialog(),content=modal.querySelector(".demo-content");
  content.innerHTML=`<div class="demo-loading"><span class="demo-spinner"></span><strong>Finding ${esc(name)}…</strong></div>`;
  modal.showModal();
  try {
    const demo=await loadDemo(name),instructions=(demo.instructions||[]).map((item,index)=>`<li><span>${index+1}</span>${esc(String(item).replace(/^Step:\s*\d+\s*/i,""))}</li>`).join("");
    content.innerHTML=`<div class="demo-heading"><span>EXERCISE GUIDE</span><h2>${esc(demo.name||name)}</h2></div><div class="demo-media"><img src="${esc(demo.demoUrl)}" alt="Demonstration of ${esc(demo.name||name)}"></div>${instructions?`<ol class="demo-cues">${instructions}</ol>`:`<p class="demo-tip">Watch the full movement and use a controlled range of motion.</p>`}<div class="demo-meta">${(demo.targetMuscles||[]).slice(0,3).map(item=>`<span>${esc(item)}</span>`).join("")} ${(demo.equipment||[]).slice(0,3).map(item=>`<span>${esc(item)}</span>`).join("")}</div><small class="demo-credit">${esc(demo.attribution||"")}</small>`;
  } catch(error) { content.innerHTML=`<div class="demo-error"><strong>Demo unavailable</strong><p>${esc(error.message)}</p><span>The exercise remains fully usable without media.</span></div>`; }
}
export function setupExerciseDemos(root=document) {
  root.addEventListener("click",event=>{const button=event.target.closest("[data-exercise-demo]");if(!button)return;event.preventDefault();openDemo(button.dataset.exerciseDemo||"");});
}

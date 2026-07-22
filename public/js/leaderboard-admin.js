import { auth, db } from "./firebase-config.js";
import { collectionGroup, doc, getDocs, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const ADMIN_EMAILS = ["leaderboard@fuelphysique.com"];
const exercises = {pull_ups:["Pull-ups","reps"],muscle_ups:["Muscle-ups","reps"],one_arm_pull_up:["One-arm pull-up","reps"],weighted_pull_up:["Weighted pull-up","kg added"],bench_press:["Bench press","kg"],squat:["Squat","kg"],deadlift:["Deadlift","kg"]};
const $=selector=>document.querySelector(selector), esc=(value="")=>String(value).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c]);
let user=null, submissions=[];
const exercise=id=>exercises[id]||[id||"Unknown",""];
async function headers(){return {Authorization:`Bearer ${await user.getIdToken()}`,"Content-Type":"application/json"};}
function submissionOwner(item){return item.ref.parent.parent?.id||"";}
function render(){
  $("#pendingCount").textContent=submissions.length;
  $("#reviewedCount").textContent="—";
  $("#reviewList").innerHTML=submissions.length?submissions.map(item=>{const ex=exercise(item.exerciseId);return `<article class="review-card" data-id="${esc(item.id)}"><div class="card-top"><div><span class="pending">PENDING</span><h2>${esc(item.displayName||"Athlete")}</h2><p>${esc(ex[0])} · <strong>${esc(item.score)} ${esc(item.unit||ex[1])}</strong></p></div><div class="meta"><span>${esc(item.category||"open")}</span><span>${item.bodyWeight?`${esc(item.bodyWeight)} kg body weight`:"Body weight not supplied"}</span></div></div><div class="video-box" data-video-box><button class="load-video" type="button">▶ Open proof link</button></div><label>Moderator note<textarea placeholder="Optional reason or review note"></textarea></label><div class="actions"><button class="reject" type="button">Reject</button><button class="approve" type="button">✓ Approve and publish</button></div></article>`}).join(""):`<div class="empty"><strong>Queue cleared 🎉</strong><span>There are no pending results to review.</span></div>`;
  $("#adminStatus").textContent="";
}
async function load(){
  $("#adminStatus").textContent="Loading pending submissions…";
  try{const snap=await getDocs(collectionGroup(db,"leaderboardSubmissions"));submissions=snap.docs.map(s=>({id:s.id,ref:s.ref,...s.data()})).filter(s=>s.status==="pending").sort((a,b)=>(a.createdAt?.seconds||0)-(b.createdAt?.seconds||0));render();}
  catch(error){console.error(error);$("#adminStatus").textContent="Firestore blocked the admin query. Add the supplied leaderboard rules in Firebase, then refresh.";}
}
async function loadVideo(card,item){
  const box=card.querySelector("[data-video-box]");box.innerHTML="<span>Creating secure review link…</span>";
  try{const proofUrl=item.proof?.url||item.video?.url||"";if(!proofUrl)throw new Error("No proof link available.");box.innerHTML=`<a class="proof-link" href="${esc(proofUrl)}" target="_blank" rel="noreferrer">Open proof link</a><small>Check the TikTok or Instagram submission directly.</small>`;}
  catch(error){box.innerHTML=`<span class="error">${esc(error.message)}</span>`;}
}
async function review(card,item,status){
  const note=card.querySelector("textarea").value.trim(),buttons=card.querySelectorAll("button");buttons.forEach(button=>button.disabled=true);
  try{const batch=writeBatch(db),now=serverTimestamp();batch.update(item.ref,{status,moderatorNote:note,reviewedAt:now,reviewedBy:user.email,updatedAt:now});if(status==="approved")batch.set(doc(db,"leaderboardEntries",item.id),{displayName:item.displayName,category:item.category,exerciseId:item.exerciseId,score:Number(item.score),unit:item.unit,bodyWeight:item.bodyWeight||null,status:"approved",verifiedAt:now,sourceSubmissionId:item.id,sourceUserId:submissionOwner(item)});await batch.commit();card.classList.add(status);setTimeout(()=>{submissions=submissions.filter(s=>s.id!==item.id);render();},450);}
  catch(error){console.error(error);buttons.forEach(button=>button.disabled=false);$("#adminStatus").textContent="Approval was blocked by Firestore rules. Apply the supplied admin rules and try again.";}
}
$("#reviewList").addEventListener("click",event=>{const card=event.target.closest(".review-card");if(!card)return;const item=submissions.find(s=>s.id===card.dataset.id);if(!item)return;if(event.target.closest(".load-video"))loadVideo(card,item);else if(event.target.closest(".approve"))review(card,item,"approved");else if(event.target.closest(".reject"))review(card,item,"rejected");});
$("#refreshButton").addEventListener("click",load);
onAuthStateChanged(auth,current=>{if(!current)return location.replace("/auth.html");if(!ADMIN_EMAILS.includes(String(current.email||"").toLowerCase())){$("#adminStatus").textContent="Access denied. This page is available only to a leaderboard administrator.";return;}user=current;load();});

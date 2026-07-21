import { auth, db } from "./firebase-config.js";
import { collection, doc, getDocs, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const exercises = [
  { id: "pull_ups", name: "Pull-ups", unit: "reps", higher: true },
  { id: "muscle_ups", name: "Muscle-ups", unit: "reps", higher: true },
  { id: "one_arm_pull_up", name: "One-arm pull-up", unit: "reps", higher: true },
  { id: "weighted_pull_up", name: "Weighted pull-up", unit: "kg added", higher: true },
  { id: "bench_press", name: "Bench press", unit: "kg", higher: true },
  { id: "squat", name: "Squat", unit: "kg", higher: true },
  { id: "deadlift", name: "Deadlift", unit: "kg", higher: true }
];
const $ = selector => document.querySelector(selector);
const exerciseById = id => exercises.find(item => item.id === id) || exercises[0];
let user = null, approvedEntries = [];

function setupExercises() {
  const options = exercises.map(item => `<option value="${item.id}">${item.name}</option>`).join("");
  $("#exerciseFilter").innerHTML = options;
  $("#submissionExercise").innerHTML = options;
  updateUnit();
}
function updateUnit() { $("#scoreUnit").textContent = exerciseById($("#submissionExercise").value).unit; }
function formatScore(entry) { const ex = exerciseById(entry.exerciseId); return `${Number(entry.score).toLocaleString(undefined, { maximumFractionDigits: 1 })} ${entry.unit || ex.unit}`; }
function escapeHtml(value="") { return String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char]); }

function renderBoard() {
  const exerciseId = $("#exerciseFilter").value, category = $("#categoryFilter").value;
  const entries = approvedEntries.filter(item => item.exerciseId === exerciseId && (category === "all" || item.category === category)).sort((a,b) => Number(b.score)-Number(a.score));
  $("#podium").innerHTML = entries.slice(0,3).map((entry,index) => `<article class="place-${index+1}"><span>${["🥇","🥈","🥉"][index]}</span><strong>${escapeHtml(entry.displayName || "Athlete")}</strong><b>${escapeHtml(formatScore(entry))}</b></article>`).join("");
  $("#rankingBody").innerHTML = entries.map((entry,index) => `<tr><td><strong>#${index+1}</strong></td><td>${escapeHtml(entry.displayName || "Athlete")}</td><td>${escapeHtml(formatScore(entry))}</td><td>${escapeHtml(entry.category || "open")}</td><td><span class="verified">✓ Verified</span></td></tr>`).join("");
  $("#boardStatus").textContent = entries.length ? `${entries.length} verified result${entries.length===1?"":"s"}` : "No verified results in this division yet. Be the first to submit.";
}
async function loadBoard() {
  try {
    const snap = await getDocs(collection(db,"leaderboardEntries"));
    approvedEntries = snap.docs.map(item => ({ id:item.id,...item.data() })).filter(item => item.status === "approved" || !item.status);
  } catch (error) { approvedEntries = []; }
  renderBoard();
}
async function loadMySubmissions() {
  const list = $("#submissionList");
  try {
    const snap = await getDocs(collection(db,"users",user.uid,"leaderboardSubmissions"));
    const items = snap.docs.map(item => ({id:item.id,...item.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
    list.innerHTML = items.length ? items.map(item => `<article><div><strong>${escapeHtml(exerciseById(item.exerciseId).name)}</strong><span>${escapeHtml(formatScore(item))}</span></div><span class="status-pill ${escapeHtml(item.status||"pending")}">${escapeHtml(item.status||"pending")}</span></article>`).join("") : `<p class="empty">You have not submitted a result yet.</p>`;
  } catch (error) { console.error(error); list.innerHTML = `<p class="empty">Could not load your submissions.</p>`; }
}
async function authHeaders(contentType) { return { Authorization:`Bearer ${await user.getIdToken()}`, "Content-Type":contentType }; }
async function deleteUploadedVideo(fileId) {
  if (!fileId) return;
  await fetch(`/api/leaderboard/video/${encodeURIComponent(fileId)}`, { method:"DELETE", headers:await authHeaders("application/json") }).catch(()=>{});
}
async function submit(event) {
  event.preventDefault();
  const file = $("#proofVideo").files[0], status = $("#formStatus"), button = $("#submitResult");
  if (!file || !["video/mp4","video/webm","video/quicktime"].includes(file.type)) return status.textContent="Choose an MP4, WebM, or MOV video.";
  if (file.size > 50*1024*1024) return status.textContent="The video must be 50 MB or smaller.";
  button.disabled = true; status.textContent = "Uploading private video…";
  const ref = doc(collection(db,"users",user.uid,"leaderboardSubmissions"));
  let uploaded;
  try {
    const response = await fetch(`/api/leaderboard/video/${ref.id}`, { method:"POST", headers:await authHeaders(file.type), body:file });
    uploaded = await response.json();
    if (!response.ok) throw new Error(uploaded.error || "Video upload failed.");
    status.textContent = "Creating verification request…";
    const exercise = exerciseById($("#submissionExercise").value);
    await setDoc(ref, { displayName:$("#displayName").value.trim(), category:$("#submissionCategory").value, exerciseId:exercise.id, score:Number($("#score").value), unit:exercise.unit, bodyWeight:$("#bodyWeight").value?Number($("#bodyWeight").value):null, status:"pending", video:{provider:"imagekit",fileId:uploaded.fileId,path:uploaded.path,url:uploaded.url}, createdAt:serverTimestamp(), updatedAt:serverTimestamp() });
    status.textContent = "Submitted! Your result is pending private review.";
    event.target.reset(); updateUnit(); await loadMySubmissions();
    setTimeout(()=>$("#submissionDialog").close(),1400);
  } catch (error) {
    await deleteUploadedVideo(uploaded?.fileId);
    status.textContent = error.message || "Could not submit your result.";
  } finally { button.disabled=false; }
}

setupExercises();
$("#exerciseFilter").addEventListener("change",renderBoard); $("#categoryFilter").addEventListener("change",renderBoard);
$("#submissionExercise").addEventListener("change",updateUnit);
$("#openSubmission").addEventListener("click",()=>$("#submissionDialog").showModal());
$("#closeSubmission").addEventListener("click",()=>$("#submissionDialog").close());
$("#submissionForm").addEventListener("submit",submit);
onAuthStateChanged(auth,async current=>{ if(!current)return location.replace("/auth.html"); user=current; $("#displayName").value=current.displayName||""; await Promise.all([loadBoard(),loadMySubmissions()]); });

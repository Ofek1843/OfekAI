import { auth, db } from "./firebase-config.js";
import { collection, doc, getDoc, setDoc, serverTimestamp, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const he = (localStorage.getItem("ofek-ai-language") || "en") === "he";
const ui = he ? {
  copyLink: "העתק לינק",
  copied: "✓ הועתק!",
  shareTitle: "שתף את התוכנית שלך",
  shareDesc: "אנשים שלא רשומים יכולים לראות את התוכנית בלי להוריד אפליקציה"
} : {
  copyLink: "Copy link",
  copied: "✓ Copied!",
  shareTitle: "Share this plan",
  shareDesc: "Anyone can view it without downloading the app"
};

// Add share button to plan cards
export async function addShareButton(planId, planName) {
  const btn = document.createElement("button");
  btn.className = "share-btn";
  btn.innerHTML = "🔗 Share";
  btn.title = ui.shareTitle;
  btn.onclick = () => sharePlan(planId, planName);
  return btn;
}

async function sharePlan(planId, planName) {
  const user = auth.currentUser;
  if (!user) return alert("Sign in to share");

  // Generate shareId
  const shareId = Math.random().toString(36).substring(2, 11);
  const shareRef = doc(db, "shares", shareId);

  try {
    await setDoc(shareRef, {
      planId,
      userId: user.uid,
      planName,
      createdAt: serverTimestamp(),
      viewCount: 0
    });

    const link = `${window.location.origin}/shared/${shareId}`;
    navigator.clipboard.writeText(link);
    btn.textContent = ui.copied;
    setTimeout(() => { btn.textContent = "🔗 Share"; }, 2000);
  } catch (err) {
    console.error(err);
    alert(ui.shareDesc);
  }
}

export async function loadSharedPlan(shareId) {
  try {
    const shareRef = doc(db, "shares", shareId);
    const shareSnap = await getDoc(shareRef);
    if (!shareSnap.exists()) return null;

    const share = shareSnap.data();
    const planRef = doc(db, "users", share.userId, "workoutPlans", share.planId);
    const planSnap = await getDoc(planRef);
    if (!planSnap.exists()) return null;

    // Increment view count
    await setDoc(shareRef, { viewCount: (share.viewCount || 0) + 1 }, { merge: true });

    return { ...planSnap.data(), sharedBy: share.userId, shareName: share.planName };
  } catch (err) {
    console.error(err);
    return null;
  }
}

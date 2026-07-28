import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { doc, getDoc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";
import { trackEvent, trackPageView } from "./analytics.js";
import { SUBSCRIPTION_PLANS } from "./subscription-plans.js";

const $ = selector => document.querySelector(selector);
const he = (localStorage.getItem("ofek-ai-language") || "en") === "he";
const pro = SUBSCRIPTION_PLANS.pro;

trackPageView({ page: "pricing" });
trackEvent("pricing_page_view", { source: "pricing" });

let activeUser = null;
let joined = false;

const copy = he
  ? {
      title: "בחר את המסלול שלך",
      subtitle: "בגישה המוקדמת הכול פתוח בחינם",
      proPrice: `₪${pro.monthlyPriceIls}`,
      proPriceNote: ` (כ־$${pro.monthlyPriceUsd} לחודש)`,
      trial: `${pro.trialDays} ימי ניסיון חינם, ואז חיוב חודשי`,
      button: "הצטרפות לרשימת ההמתנה",
      joining: "מצטרף...",
      joined: "נרשמת לרשימת ההמתנה ✓",
      success: "נרשמת בהצלחה. לא הוזן כרטיס ולא בוצע חיוב.",
      error: "לא הצלחנו לשמור את ההצטרפות. נסה שוב.",
      note: "ללא כרטיס אשראי. נעדכן אותך לפני שהמסלול בתשלום ייפתח."
    }
  : {
      title: "Choose Your Plan",
      subtitle: "Free forever or Pro for unlimited access",
      proPrice: `$${pro.monthlyPriceUsd}`,
      proPriceNote: "/month",
      trial: `${pro.trialDays}-day free trial, then billed monthly`,
      button: "Join the Pro waitlist",
      joining: "Joining...",
      joined: "Joined the Pro waitlist ✓",
      success: "You're on the waitlist. No card was entered and no charge was made.",
      error: "Could not join the waitlist. Please try again.",
      note: "No card required. We'll notify you before Pro becomes a paid plan."
    };

function localize() {
  if (he) {
    document.documentElement.lang = "he";
    document.documentElement.dir = "rtl";
  }
  const heroTitle = $("#pricingTitle");
  if (heroTitle) heroTitle.textContent = copy.title;
  const heroSubtitle = $("#pricingSubtitle");
  if (heroSubtitle) heroSubtitle.textContent = copy.subtitle;

  const priceAmount = $("#proPriceAmount");
  if (priceAmount) priceAmount.innerHTML = `${copy.proPrice}<span>${copy.proPriceNote}</span>`;
  const trialNote = $("#proTrialNote");
  if (trialNote) trialNote.textContent = copy.trial;
  const note = $("#proNote");
  if (note) note.textContent = copy.note;

  const button = $("#upgradeButton");
  if (button) button.textContent = copy.button;
}

function showJoined() {
  joined = true;
  const button = $("#upgradeButton");
  button.textContent = copy.joined;
  button.disabled = true;
}

localize();

$("#upgradeButton")?.addEventListener("click", async () => {
  if (joined) return;
  if (!activeUser) {
    location.href = "/auth.html";
    return;
  }
  const button = $("#upgradeButton");
  button.disabled = true;
  button.textContent = copy.joining;
  try {
    const reference = doc(db, "users", activeUser.uid, "waitlists", "pro");
    const existing = await getDoc(reference);
    await setDoc(reference, {
      email: activeUser.email || "",
      plannedPriceUsd: pro.monthlyPriceUsd,
      plannedPriceIls: pro.monthlyPriceIls,
      plannedTrialDays: pro.trialDays,
      status: "interested",
      source: "pricing-page",
      updatedAt: serverTimestamp(),
      ...(existing.exists() ? {} : { createdAt: serverTimestamp() })
    }, { merge: true });
    trackEvent("pricing_click", { source: "waitlist" });
    trackEvent("upgrade_clicked", { source: "waitlist" });
    showJoined();
    $("#pricingStatus").textContent = copy.success;
  } catch (error) {
    console.error("Waitlist signup failed:", error);
    button.disabled = false;
    button.textContent = copy.button;
    $("#pricingStatus").classList.add("error");
    $("#pricingStatus").textContent = copy.error;
  }
});

onAuthStateChanged(auth, async user => {
  activeUser = user;
  if (!user) return;
  try {
    const snapshot = await getDoc(doc(db, "users", user.uid, "waitlists", "pro"));
    if (snapshot.exists()) showJoined();
  } catch (error) {
    console.error("Waitlist status check failed:", error);
  }
});

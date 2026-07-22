import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";
import { trackEvent } from "./analytics.js";
import { normalizeSubscription } from "./subscription-plans.js";

const he=(localStorage.getItem("ofek-ai-language")||"en")==="he";
const result=new URLSearchParams(location.search).get("result")||"failure";
const $=selector=>document.querySelector(selector);
if(he){document.documentElement.lang="he";document.documentElement.dir="rtl";}
function render(kind){const copy=he?{
  active:["✅","המינוי פעיל","FuelPhysique Pro הופעל בהצלחה בחשבון שלך.","חזרה לדשבורד"],
  pending:["⏳","התשלום התקבל","ממתינים לאישור המאובטח של PayPlus. אין צורך לשלם שוב.","חזרה למסלולים"],
  failure:["⚠️","התשלום לא הושלם","לא בוצע שינוי במינוי. אפשר לנסות שוב מעמוד המסלולים.","חזרה למסלולים"],
  cancelled:["↩","התשלום בוטל","לא חויבת ולא בוצע שינוי במינוי.","חזרה למסלולים"]
}:{active:["✅","Your subscription is active","FuelPhysique Pro is now active on your account.","Go to dashboard"],pending:["⏳","Payment received","Waiting for secure confirmation from PayPlus. You do not need to pay again.","Return to plans"],failure:["⚠️","Payment was not completed","Your plan was not changed. You can try again from the plans page.","Return to plans"],cancelled:["↩","Checkout cancelled","You were not charged and your plan was not changed.","Return to plans"]};const item=copy[kind];$("#resultIcon").textContent=item[0];$("#resultTitle").textContent=item[1];$("#resultText").textContent=item[2];$("#resultAction").textContent=item[3];$("#resultAction").href=kind==="active"?"/dashboard.html":"/pricing.html";}
if(result!=="success"){if(result==="cancelled")trackEvent("subscription_cancelled",{source:"billing_result"});render(result==="cancelled"?"cancelled":"failure");}else{render("pending");trackEvent("checkout_started",{source:"billing_result"});onAuthStateChanged(auth,async user=>{if(!user)return;let attempts=0;const check=async()=>{attempts++;const snap=await getDoc(doc(db,"users",user.uid));if(normalizeSubscription(snap.exists()?snap.data().subscription:{}).planId==="pro"){trackEvent("subscription_completed",{source:"billing_result"});return render("active");}if(attempts<8)setTimeout(check,1500)};check()})}

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { doc, getDoc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";
import { trackEvent, trackPageView } from "./analytics.js";
import { SUBSCRIPTION_PLANS } from "./subscription-plans.js";

const $=selector=>document.querySelector(selector);
const he=(localStorage.getItem("ofek-ai-language")||"en")==="he";
let activeUser=null;
let joined=false;
trackPageView({ page: "pricing" });
const copy=he?{
  eyebrow:"להתאמן חכם יותר",title:"האימונים שלך. ההתקדמות שלך. מסלול אחד.",intro:"בגישה המוקדמת הכול פתוח בחינם. הצטרף לרשימת ההמתנה כדי לשמוע כש־Pro יושק החל מ־₪25 לחודש.",dashboard:"דשבורד",current:"פתוח עכשיו",freeCopy:"כל יכולות FuelPhysique פתוחות כרגע כדי שתוכל לנסות ולהחליט אם המוצר מתאים לך.",forever:"בגישה המוקדמת",proCopy:"היכולות המתקדמות שמתוכננות להיכלל ב־Pro לאחר ההשקה.",month:he?"לחודש לאחר ההשקה":"per month after launch",choose:"הצטרפות לרשימת ההמתנה",popular:"מתוכנן להמשך",secureTitle:"הכול פתוח עכשיו",secureText:"נסה כל יכולת של FuelPhysique בחינם בתקופת הגישה המוקדמת.",cancelTitle:"ללא פרטי תשלום",cancelText:"רשימת ההמתנה אינה מבקשת כרטיס ואינה מחייבת אותך.",instantTitle:"עדכון לפני ההשקה",instantText:"נעדכן את המתעניינים לפני ש־Pro יהפוך למסלול בתשלום.",joined:"נרשמת לרשימת ההמתנה ✓",success:"נרשמת בהצלחה. לא הזנת כרטיס ולא בוצע חיוב.",login:"יש להתחבר כדי להצטרף לרשימת ההמתנה.",features:{free:["גישה לכל הפיצ׳רים בתקופת Early Access","עד חמש תוכניות אימון כרגע","עד חמש תוכניות תזונה כרגע","מעקב, גרפים, AI ושיתוף פתוחים כרגע"],pro:["עד חמש תוכניות אימון","עד חמש תוכניות תזונה","גרפים וניתוחי התקדמות מלאים","מעקב אימונים מתקדם","זיכרון מאמן AI ושימוש מורחב","שיתוף וייצוא תוכניות","תג Pro בלידרבורד"]}
}:null;

function localize(){
  const priceAmount = document.getElementById("proPriceAmount");
  if (priceAmount) priceAmount.textContent = he ? "מ־₪25" : "From $25";
  const features=he?copy.features:{free:["Access to every feature during Early Access","Up to five workout plans right now","Up to five nutrition plans right now","Tracking, charts, AI and sharing unlocked"],pro:SUBSCRIPTION_PLANS.pro.features};
  $("#freeFeatures").innerHTML=features.free.map(item=>`<li>${item}</li>`).join("");$("#proFeatures").innerHTML=features.pro.map(item=>`<li>${item}</li>`).join("");
  $("#currentPlanBadge").textContent=he?"גישה מוקדמת":"Early Access";$("#freeCurrent").hidden=false;$("#proCurrent").hidden=true;
  if(!he)return;document.documentElement.lang="he";document.documentElement.dir="rtl";
  const ids={eyebrow:"eyebrow",pricingTitle:"title",pricingIntro:"intro",dashboardLink:"dashboard",freeCurrent:"current",freeCopy:"freeCopy",foreverText:"forever",proCopy:"proCopy",monthText:"month",upgradeButton:"choose",popularText:"popular",secureTitle:"secureTitle",secureText:"secureText",cancelTitle:"cancelTitle",cancelText:"cancelText",instantTitle:"instantTitle",instantText:"instantText"};for(const[id,key]of Object.entries(ids))$("#"+id).textContent=copy[key];
  $("#testModeText").textContent="גישה מוקדמת — הכול פתוח כרגע בחינם";$("#upgradeHint").textContent="ללא כרטיס וללא חיוב. נעדכן אותך לפני ההשקה.";$("#freeButton").textContent="כל הפיצ׳רים פתוחים";
}

function showJoined(){joined=true;const button=$("#upgradeButton");button.textContent=he?copy.joined:"Joined the Pro wishlist ✓";button.disabled=true;}

localize();
$("#upgradeButton").addEventListener("click",async()=>{
  if(joined)return;if(!activeUser){location.href="/auth.html";return;}const button=$("#upgradeButton");button.disabled=true;button.textContent=he?"מצטרף...":"Joining...";
  try{const reference=doc(db,"users",activeUser.uid,"waitlists","pro");const existing=await getDoc(reference);await setDoc(reference,{email:activeUser.email||"",plannedPriceIls:25,status:"interested",source:"pricing-page",updatedAt:serverTimestamp(),...(existing.exists()?{}:{createdAt:serverTimestamp()})},{merge:true});trackEvent("pricing_click", { source: "wishlist" });showJoined();$("#pricingStatus").textContent=he?copy.success:"You're on the wishlist. No card was entered and no charge was made.";}catch(error){console.error("Wishlist signup failed:",error);button.disabled=false;button.textContent=he?copy.choose:"Join the Pro wishlist";$("#pricingStatus").classList.add("error");$("#pricingStatus").textContent=he?"לא הצלחנו לשמור את ההצטרפות. נסה שוב.":"Could not join the wishlist. Please try again.";}
});
$("#freeButton").disabled=true;
onAuthStateChanged(auth,async user=>{activeUser=user;if(!user)return;try{const snapshot=await getDoc(doc(db,"users",user.uid,"waitlists","pro"));if(snapshot.exists())showJoined();}catch(error){console.error("Wishlist status failed:",error);}});




import { auth, db, storage } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { collection, doc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { ref, uploadBytes } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-storage.js";
import { trackClick, trackPageView } from "./analytics.js";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const VALID_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VALID_PROCESS_TYPES = new Set([
  "bulk",
  "cut",
  "body-recomposition",
  "general-fitness-change",
  "other"
]);

const COPY = {
  en: {
    backToResults: "Results",
    login: "Login",
    kicker: "COMMUNITY SUBMISSION",
    title: "Submit your transformation",
    intro:
      "Share before-and-after photos and a few details. Your submission stays private while the FuelPhysique team reviews it.",
    privacy: "Nothing is published automatically. Public publication requires explicit consent.",
    authRequiredTitle: "Sign in required",
    authRequiredText:
      "You can fill the form now, but you must log in before submitting private progress photos.",
    loginToSubmit: "Log in to submit",
    formKicker: "PENDING MANUAL REVIEW",
    formTitle: "Transformation details",
    formDescription: "Use clear photos taken from similar angles when possible. Accepted formats: JPEG, PNG and WebP.",
    beforePhoto: "Before photo",
    afterPhoto: "After photo",
    durationValue: "Duration value",
    durationUnit: "Duration unit",
    weeks: "Weeks",
    months: "Months",
    processType: "Process type",
    chooseProcess: "Choose process",
    bulk: "Bulk",
    cut: "Cut",
    recomposition: "Body recomposition",
    generalFitness: "General fitness change",
    other: "Other",
    displayName: "Optional display name",
    toolsUsed: "Which FuelPhysique tools were used?",
    toolWorkoutPlans: "Workout plans",
    toolNutritionPlans: "Nutrition plans",
    toolWorkoutTracking: "Workout tracking",
    toolProgressPhotos: "Progress photos and charts",
    description: "Short optional description",
    displayOptions: "Display options",
    anonymousDefault: "Appear anonymously by default",
    blurFace: "I allow FuelPhysique to blur my face before any approved publication",
    consentTitle: "Consent and privacy",
    consentOwns: "I own these photos or have permission to submit them.",
    consentAdults: "Everyone shown is at least 18 years old.",
    consentReview: "FuelPhysique may review this private submission.",
    consentNotAuto: "I understand the photos will not be published automatically.",
    consentExplicit: "Public publication requires explicit consent.",
    consentRemoval: "I may request removal later.",
    consentResults: "This result is not guaranteed to be representative of other users.",
    submitButton: "Submit my transformation",
    submitting: "Submitting securely...",
    success:
      "Submission received.\nYour photos will remain private while the FuelPhysique team reviews them.",
    missingPhotos: "Please add both before and after photos.",
    invalidImage: "Upload JPEG, PNG or WebP images up to 8MB each.",
    invalidDuration: "Enter a duration greater than zero.",
    invalidProcess: "Choose a process type.",
    missingTools: "Choose at least one FuelPhysique tool you used.",
    missingConsent: "Please confirm every required consent checkbox.",
    genericError: "Could not complete the submission. Please try again in a moment.",
    placeholderDescription: "What changed in your training, nutrition or consistency?"
  },
  he: {
    backToResults: "תוצאות",
    login: "כניסה",
    kicker: "הגשה מהקהילה",
    title: "שליחת התהליך שלך",
    intro:
      "שתפו תמונות לפני ואחרי וכמה פרטים קצרים. ההגשה נשארת פרטית בזמן שצוות FuelPhysique בודק אותה.",
    privacy: "שום דבר לא מתפרסם אוטומטית. פרסום ציבורי דורש הסכמה מפורשת.",
    authRequiredTitle: "נדרשת התחברות",
    authRequiredText: "אפשר למלא את הטופס עכשיו, אבל כדי לשלוח תמונות התקדמות פרטיות צריך להתחבר לחשבון.",
    loginToSubmit: "כניסה לשליחה",
    formKicker: "ממתין לבדיקה ידנית",
    formTitle: "פרטי התהליך",
    formDescription: "מומלץ להשתמש בתמונות ברורות מזוויות דומות. ניתן להעלות JPEG, PNG ו-WebP.",
    beforePhoto: "תמונת לפני",
    afterPhoto: "תמונת אחרי",
    durationValue: "משך התהליך",
    durationUnit: "יחידת זמן",
    weeks: "שבועות",
    months: "חודשים",
    processType: "סוג התהליך",
    chooseProcess: "בחרו סוג תהליך",
    bulk: "מסה",
    cut: "חיטוב",
    recomposition: "שינוי הרכב גוף",
    generalFitness: "שינוי כושר כללי",
    other: "אחר",
    displayName: "שם תצוגה אופציונלי",
    toolsUsed: "באילו כלים של FuelPhysique השתמשתם?",
    toolWorkoutPlans: "תוכניות אימון",
    toolNutritionPlans: "תפריטי תזונה",
    toolWorkoutTracking: "מעקב אימונים",
    toolProgressPhotos: "תמונות וגרפים",
    description: "תיאור קצר אופציונלי",
    displayOptions: "אפשרויות תצוגה",
    anonymousDefault: "להופיע כברירת מחדל כאנונימי",
    blurFace: "אני מאשר/ת ל-FuelPhysique לטשטש את הפנים לפני פרסום מאושר",
    consentTitle: "הסכמה ופרטיות",
    consentOwns: "התמונות בבעלותי או שיש לי הרשאה לשלוח אותן.",
    consentAdults: "כל מי שמופיע בתמונות הוא לפחות בן 18.",
    consentReview: "FuelPhysique רשאית לבדוק את ההגשה הפרטית.",
    consentNotAuto: "אני מבין/ה שהתמונות לא יתפרסמו אוטומטית.",
    consentExplicit: "פרסום ציבורי דורש הסכמה מפורשת.",
    consentRemoval: "אפשר לבקש הסרה בהמשך.",
    consentResults: "התוצאה אינה מובטחת או מייצגת בהכרח משתמשים אחרים.",
    submitButton: "שליחת התהליך שלי",
    submitting: "שולח בצורה מאובטחת...",
    success:
      "השליחה התקבלה.\nהתמונות יישארו פרטיות בזמן שצוות FuelPhysique בודק את הבקשה.",
    missingPhotos: "נא לצרף גם תמונת לפני וגם תמונת אחרי.",
    invalidImage: "ניתן להעלות תמונות JPEG, PNG או WebP עד 8MB לכל תמונה.",
    invalidDuration: "נא להזין משך תהליך גדול מאפס.",
    invalidProcess: "נא לבחור סוג תהליך.",
    missingTools: "נא לבחור לפחות כלי אחד של FuelPhysique שבו השתמשתם.",
    missingConsent: "נא לאשר את כל סעיפי ההסכמה הנדרשים.",
    genericError: "לא ניתן להשלים את השליחה כרגע. נסו שוב בעוד רגע.",
    placeholderDescription: "מה השתנה באימון, בתזונה או בעקביות?"
  }
};

const language = (localStorage.getItem("ofek-ai-language") || "en") === "he" ? "he" : "en";
const copy = COPY[language];
const form = document.getElementById("transformationSubmissionForm");
const statusElement = document.getElementById("submissionStatus");
const submitButton = document.getElementById("submitTransformationButton");
const authWarning = document.getElementById("submissionAuthWarning");
const authLink = document.getElementById("submissionAuthLink");
let currentUser = null;

document.documentElement.lang = language;
document.documentElement.dir = language === "he" ? "rtl" : "ltr";

function applyCopy() {
  document.querySelectorAll("[data-submit-i18n]").forEach((element) => {
    const key = element.dataset.submitI18n;
    if (copy[key]) element.textContent = copy[key];
  });
  const description = document.getElementById("description");
  if (description) description.placeholder = copy.placeholderDescription;
}

function setStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.classList.toggle("is-error", isError);
}

function updatePreview(inputId, previewId) {
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  if (!input || !preview) return;

  input.addEventListener("change", () => {
    preview.textContent = "";
    const file = input.files?.[0];
    if (!file) return;

    if (!VALID_MIME_TYPES.has(file.type) || file.size > MAX_IMAGE_BYTES) {
      preview.textContent = copy.invalidImage;
      return;
    }

    const image = document.createElement("img");
    const objectUrl = URL.createObjectURL(file);
    image.src = objectUrl;
    image.alt = inputId === "beforePhoto" ? copy.beforePhoto : copy.afterPhoto;
    image.onload = () => URL.revokeObjectURL(objectUrl);
    preview.appendChild(image);
  });
}

async function detectImageMime(file) {
  const buffer = await file.slice(0, 16).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isWebp =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;
  if (isJpeg) return "image/jpeg";
  if (isPng) return "image/png";
  if (isWebp) return "image/webp";
  return "";
}

async function validateImage(file) {
  if (!file || file.size > MAX_IMAGE_BYTES || !VALID_MIME_TYPES.has(file.type)) return false;
  const detectedMime = await detectImageMime(file);
  return detectedMime === file.type || (file.type === "image/jpeg" && detectedMime === "image/jpeg");
}

async function stripMetadataWhenPractical(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    context.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    return blob || file;
  } catch {
    return file;
  }
}

function selectedTools() {
  return [...form.querySelectorAll('input[name="toolsUsed"]:checked')].map((input) => input.value);
}

function consentState() {
  return Object.fromEntries(
    [...form.querySelectorAll("[data-consent]")].map((input) => [input.dataset.consent, input.checked])
  );
}

async function uploadPrivateImage({ file, userId, submissionId, slot }) {
  const sanitizedBlob = await stripMetadataWhenPractical(file);
  const extension = sanitizedBlob.type === "image/png" ? "png" : sanitizedBlob.type === "image/webp" ? "webp" : "jpg";
  const fullPath = `users/${userId}/transformationSubmissions/${submissionId}/${slot}.${extension}`;
  const storageRef = ref(storage, fullPath);
  await uploadBytes(storageRef, sanitizedBlob, {
    contentType: sanitizedBlob.type || "image/jpeg",
    customMetadata: {
      ownerUid: userId,
      submissionId,
      visibility: "private",
      moderationStatus: "pending"
    }
  });
  return {
    storagePath: fullPath,
    contentType: sanitizedBlob.type || "image/jpeg",
    originalContentType: file.type,
    originalSize: file.size,
    storedSize: sanitizedBlob.size || file.size,
    metadataStripped: sanitizedBlob !== file
  };
}

async function handleSubmit(event) {
  event.preventDefault();
  if (!currentUser) {
    setStatus(copy.authRequiredText, true);
    document.getElementById("submissionAuthWarning")?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const beforeFile = document.getElementById("beforePhoto").files[0];
  const afterFile = document.getElementById("afterPhoto").files[0];
  const durationValue = Number(document.getElementById("durationValue").value);
  const durationUnit = document.getElementById("durationUnit").value;
  const processType = document.getElementById("processType").value;
  const tools = selectedTools();
  const consents = consentState();

  if (!beforeFile || !afterFile) return setStatus(copy.missingPhotos, true);
  if (!(await validateImage(beforeFile)) || !(await validateImage(afterFile))) return setStatus(copy.invalidImage, true);
  if (!Number.isFinite(durationValue) || durationValue <= 0) return setStatus(copy.invalidDuration, true);
  if (!VALID_PROCESS_TYPES.has(processType)) return setStatus(copy.invalidProcess, true);
  if (tools.length === 0) return setStatus(copy.missingTools, true);
  if (Object.values(consents).some((value) => value !== true)) return setStatus(copy.missingConsent, true);

  submitButton.disabled = true;
  submitButton.textContent = copy.submitting;
  setStatus("");

  try {
    const submissionRef = doc(collection(db, "users", currentUser.uid, "transformationSubmissions"));
    const [beforeUpload, afterUpload] = await Promise.all([
      uploadPrivateImage({ file: beforeFile, userId: currentUser.uid, submissionId: submissionRef.id, slot: "before" }),
      uploadPrivateImage({ file: afterFile, userId: currentUser.uid, submissionId: submissionRef.id, slot: "after" })
    ]);

    await setDoc(submissionRef, {
      status: "pending",
      publicationStatus: "private",
      moderationStatus: "pending",
      anonymous: document.getElementById("anonymousDisplay").checked,
      blurFacePermission: document.getElementById("blurFacePermission").checked,
      displayName: document.getElementById("displayName").value.trim().slice(0, 60),
      duration: {
        value: durationValue,
        unit: durationUnit
      },
      processType,
      toolsUsed: tools,
      description: document.getElementById("description").value.trim().slice(0, 800),
      consents,
      publicPublicationRequiresExplicitConsent: true,
      publicPublicationApproved: false,
      autoPublish: false,
      privateContactEmail: currentUser.email || "",
      images: {
        before: beforeUpload,
        after: afterUpload
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    form.reset();
    document.getElementById("anonymousDisplay").checked = true;
    document.getElementById("beforePhotoPreview").textContent = "";
    document.getElementById("afterPhotoPreview").textContent = "";
    setStatus(copy.success);
    trackClick("transformation_submission_created", { source: "landing_transformation_submit" });
  } catch (error) {
    console.error("Transformation submission failed", error?.code || error?.message || error);
    setStatus(copy.genericError, true);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = copy.submitButton;
  }
}

applyCopy();
updatePreview("beforePhoto", "beforePhotoPreview");
updatePreview("afterPhoto", "afterPhotoPreview");
trackPageView({ page: "transformation_submit" });

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  authWarning.hidden = Boolean(user);
  if (authLink) authLink.href = user ? "/dashboard.html" : "/auth.html?next=transformation-submit.html";
});

form.addEventListener("submit", handleSubmit);

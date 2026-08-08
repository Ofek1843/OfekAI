import { auth, db } from "./firebase-config.js";
import { t } from "./i18n.js";
import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

import {
    onAuthStateChanged,
    updateProfile,
    EmailAuthProvider,
    GoogleAuthProvider,
    reauthenticateWithCredential,
    reauthenticateWithPopup,
    signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import { shouldBlockUnverifiedAccess } from "./verification-gate.js";
import { directImageKitUpload } from "./imagekit-upload.js";

/*
 * FuelPhysique AI — Settings Controller
 * Firestore path: users/{uid}/settings/main
 */

const SETTINGS_DOC_PATH = (uid) =>
    doc(db, "users", uid, "settings", "main");

const THEME_STORAGE_KEY = "ofek-ai-theme";
const settingsParams = new URLSearchParams(window.location.search);
const settingsOpenedAsPage = settingsParams.get("settings") === "open";
const settingsInitialSection = settingsParams.get("section") || "";

const elements = {
    overlay: document.getElementById("settingsOverlay"),
    openBtn: document.getElementById("settingsBtn"),
    closeBtn: document.getElementById("closeSettingsBtn"),
    cancelBtn: document.getElementById("cancelSettingsBtn"),
    saveBtn: document.getElementById("saveSettingsBtn"),

    fullName: document.getElementById("settingsFullName"),
    email: document.getElementById("settingsEmail"),
    socialPhoto: document.getElementById("settingsSocialPhoto"),
    socialPhotoPreview: document.getElementById("settingsSocialPhotoPreview"),
    socialPhotoFallback: document.getElementById("settingsSocialPhotoFallback"),
    socialDisplayName: document.getElementById("settingsSocialDisplayName"),
    socialUsername: document.getElementById("settingsSocialUsername"),
    socialUsernameError: document.getElementById("settingsSocialUsernameError"),
    socialBio: document.getElementById("settingsSocialBio"),
    age: document.getElementById("settingsAge"),
    weight: document.getElementById("settingsWeight"),
    height: document.getElementById("settingsHeight"),
    experience: document.getElementById("settingsExperience"),
    goal: document.getElementById("settingsGoal"),
    limitations: document.getElementById("settingsLimitations"),
    trainingDays: document.getElementById("settingsTrainingDays"),
    trainingStyle: document.getElementById("settingsTrainingStyle"),
    equipment: document.getElementById("settingsEquipment"),
    favoriteFoods: document.getElementById("settingsFavoriteFoods"),
    dislikedFoods: document.getElementById("settingsDislikedFoods"),
    dietaryRestrictions: document.getElementById("settingsDietaryRestrictions"),
    personalNotes: document.getElementById("settingsPersonalNotes"),

    responseDepth: document.getElementById("settingsResponseDepth"),
    coachingStyle: document.getElementById("settingsCoachingStyle"),
    useAthleteCore: document.getElementById(
        "settingsUseAthleteCore"
    ),
    evidenceBased: document.getElementById(
        "settingsEvidenceBased"
    ),

    language: document.getElementById("settingsLanguage"),
    theme: document.getElementById("settingsTheme"),
    exportAccount: document.getElementById("exportAccountBtn"),
    deleteAccount: document.getElementById("deleteAccountBtn"),
    accountTitle: document.getElementById("accountTitle"),
    accountDescription: document.getElementById("accountDescription"),
    deleteAccountTitle: document.getElementById("deleteAccountTitle"),
    deleteAccountHint: document.getElementById("deleteAccountHint"),
    accountActionStatus: document.getElementById("accountActionStatus"),
    deleteDialog: document.getElementById("deleteAccountDialog"),
    deleteForm: document.getElementById("deleteAccountForm"),
    deleteConfirm: document.getElementById("deleteAccountConfirm"),
    deletePassword: document.getElementById("deleteAccountPassword"),
    deletePasswordLabel: document.getElementById("deleteAccountPasswordLabel"),
    deleteDialogStatus: document.getElementById("deleteAccountDialogStatus"),
    deleteDialogCancel: document.getElementById("deleteAccountCancel"),
    deleteDialogConfirm: document.getElementById("deleteAccountConfirmButton")
};

const tabs = [
    ...document.querySelectorAll(".settings-tab")
];

const pages = [
    ...document.querySelectorAll(".settings-page")
];

let activeUser = null;
let loadedSettings = {};
let isSaving = false;
let systemThemeQuery = null;
let loadedSocialProfile = null;

function normalizeText(value) {
    return typeof value === "string"
        ? value.trim()
        : "";
}

function settingsLanguage() {
    return elements.language?.value || loadedSettings.language || localStorage.getItem("ofek-ai-language") || "en";
}

function clearUsernameError() {
    const input = elements.socialUsername;
    const error = elements.socialUsernameError;
    input?.removeAttribute("aria-invalid");
    input?.removeAttribute("aria-describedby");
    if (error) {
        error.textContent = "";
        error.hidden = true;
    }
}

function usernameErrorCopy(error = {}) {
    const hebrew = settingsLanguage() === "he";
    if (error.code === "username_taken") {
        return hebrew ? "שם המשתמש כבר תפוס.\nבחרו שם משתמש אחר." : "Username is already taken.\nChoose another username.";
    }
    if (error.code === "invalid_username") {
        return hebrew ? "שם המשתמש חייב להכיל 3–20 אותיות, מספרים, קווים תחתונים או נקודות." : "Use 3–20 letters, numbers, underscores or periods for your username.";
    }
    if (error.code === "username_required") {
        return hebrew ? "בחרו שם משתמש לפני שמירת הפרופיל." : "Choose a username before saving your profile.";
    }
    return hebrew ? "לא ניתן לאמת את שם המשתמש כרגע." : "This username could not be verified. Try another one.";
}

function setUsernameError(error) {
    const input = elements.socialUsername;
    const message = usernameErrorCopy(error);
    if (!input || !elements.socialUsernameError) return;
    input.setAttribute("aria-invalid", "true");
    input.setAttribute("aria-describedby", elements.socialUsernameError.id);
    elements.socialUsernameError.textContent = message;
    elements.socialUsernameError.hidden = false;
}

function numberOrNull(value) {
    if (
        value === "" ||
        value === null ||
        value === undefined
    ) {
        return null;
    }

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : null;
}

function booleanValue(element, fallback = false) {
    return element
        ? Boolean(element.checked)
        : fallback;
}

function setInputValue(element, value = "") {
    if (element) {
        element.value = value ?? "";
    }
}

function setCheckboxValue(element, value = false) {
    if (element) {
        element.checked = Boolean(value);
    }
}

async function socialApi(path, options = {}) {
    const user = auth.currentUser || activeUser;
    if (!user) throw new Error("Authentication is required.");
    const response = await fetch(`/api/social${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${await user.getIdToken()}`,
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...(options.headers || {})
        }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.error || "Could not save your Social profile.");
        error.code = data.code || "social_profile_save_failed";
        error.status = response.status;
        error.details = data.details;
        throw error;
    }
    return data;
}

function setAccountStatus(message, type = "info") {
    if (!elements.accountActionStatus) return;
    elements.accountActionStatus.textContent = message;
    elements.accountActionStatus.dataset.type = type;
}

function accountCopy() {
    return settingsLanguage() === "he" ? {
        title: "חשבון ופרטיות",
        description: "אפשר להוריד את הנתונים שנשמרו עבור החשבון או למחוק את החשבון לצמיתות. המחיקה מסירה נתונים פרטיים, פרופיל חברתי, שיתופים, התקנות התראות וגישה לחשבון. לא ניתן לבטל אותה.",
        export: "הורדת הנתונים שלי",
        deleteTitle: "מחיקת חשבון",
        deleteHint: "להגנתך תתבקשו להזדהות מחדש ולהקליד DELETE לפני שהחשבון יימחק לצמיתות.",
        delete: "מחיקת החשבון לצמיתות",
        preparing: "מכינים את הייצוא…",
        downloaded: "ייצוא נתוני החשבון הורד.",
        exportFailed: "לא ניתן להכין את ייצוא הנתונים.",
        signInRequired: "יש להתחבר כדי למחוק את החשבון.",
        deletionFailed: "לא ניתן למחוק את החשבון."
    } : {
        title: "Account & Privacy",
        description: "Download the data held for your account, or permanently delete it. Deletion removes your private records, social profile, shares, notification installations and account access. It cannot be undone.",
        export: "Download my data",
        deleteTitle: "Delete account",
        deleteHint: "For your protection, you will reauthenticate and type DELETE before the account is permanently removed.",
        delete: "Delete my account permanently",
        preparing: "Preparing your export…",
        downloaded: "Your account export has downloaded.",
        exportFailed: "Could not prepare your export.",
        signInRequired: "You must be signed in to delete your account.",
        deletionFailed: "Could not delete your account."
    };
}

function localizeAccountSettings() {
    const copy = accountCopy();
    if (elements.accountTitle) elements.accountTitle.textContent = copy.title;
    if (elements.accountDescription) elements.accountDescription.textContent = copy.description;
    if (elements.exportAccount) elements.exportAccount.textContent = copy.export;
    if (elements.deleteAccountTitle) elements.deleteAccountTitle.textContent = copy.deleteTitle;
    if (elements.deleteAccountHint) elements.deleteAccountHint.textContent = copy.deleteHint;
    if (elements.deleteAccount) elements.deleteAccount.textContent = copy.delete;
}

async function accountApi(path, options = {}) {
    const user = auth.currentUser || activeUser;
    if (!user) throw new Error("Authentication is required.");
    const response = await fetch(`/api/account${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${await user.getIdToken(true)}`,
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...(options.headers || {})
        }
    });
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const error = new Error(body.error || "Could not complete the account request.");
        error.code = body.code || "account_request_failed";
        throw error;
    }
    return response;
}

async function exportAccount() {
    const copy = accountCopy();
    try {
        setAccountStatus(copy.preparing);
        const response = await accountApi("/export");
        const blob = await response.blob();
        const href = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = href;
        link.download = "fuelphysique-account-export.json";
        link.click();
        URL.revokeObjectURL(href);
        setAccountStatus(copy.downloaded, "success");
    } catch (error) {
        setAccountStatus(error.message || copy.exportFailed, "error");
    }
}

async function reauthenticateForDeletion(user) {
    const providers = user.providerData?.map((provider) => provider.providerId) || [];
    if (providers.includes("password")) {
        const password = elements.deletePassword?.value || "";
        if (!password) throw new Error(settingsLanguage() === "he" ? "יש להזין את הסיסמה הנוכחית כדי להמשיך." : "Enter your current password to continue.");
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email || "", password));
        return;
    }
    if (providers.includes("google.com")) {
        await reauthenticateWithPopup(user, new GoogleAuthProvider());
        return;
    }
    throw new Error("Reauthentication is not available for this sign-in method. Contact support for help deleting your account.");
}

function deletionCopy() {
    return settingsLanguage() === "he" ? {
        title: "למחוק את החשבון לצמיתות?", description: "לא ניתן לבטל פעולה זו. הרשומות הפרטיות, הפרופיל החברתי, השיתופים, התקנות ההתראות והגישה לחשבון יוסרו.", confirmation: "הקלד/י DELETE לאישור", password: "סיסמה נוכחית", cancel: "ביטול", submit: "מחיקת החשבון", deleting: "מוחקים את החשבון ואת הנתונים הפרטיים…", reauth: "מאמתים מחדש…", wrongConfirmation: "יש להקליד DELETE כדי להמשיך."
    } : {
        title: "Permanently delete account?", description: "This cannot be undone. Your private records, social profile, shares, notification installations and account access will be removed.", confirmation: "Type DELETE to confirm", password: "Current password", cancel: "Cancel", submit: "Delete account", deleting: "Deleting your account and private data…", reauth: "Reauthenticating…", wrongConfirmation: "Type DELETE to continue."
    };
}

function openDeleteAccountDialog() {
    const user = auth.currentUser || activeUser;
    if (!user) return setAccountStatus(accountCopy().signInRequired, "error");
    const copy = deletionCopy();
    const providers = user.providerData?.map((provider) => provider.providerId) || [];
    elements.deleteDialog.querySelector("#deleteAccountDialogTitle").textContent = copy.title;
    elements.deleteDialog.querySelector("#deleteAccountDialogDescription").textContent = copy.description;
    elements.deleteDialog.querySelector("#deleteAccountConfirmLabel span").textContent = copy.confirmation;
    elements.deleteDialog.querySelector("#deleteAccountPasswordLabel span").textContent = copy.password;
    elements.deleteDialogCancel.textContent = copy.cancel;
    elements.deleteDialogConfirm.textContent = copy.submit;
    elements.deletePasswordLabel.hidden = !providers.includes("password");
    elements.deleteConfirm.value = "";
    elements.deletePassword.value = "";
    elements.deleteDialogStatus.textContent = "";
    elements.deleteDialog.showModal();
    elements.deleteConfirm.focus();
}

async function deleteAccount() {
    const user = auth.currentUser || activeUser;
    const copy = deletionCopy();
    if (!user) return;
    if (elements.deleteConfirm.value.trim() !== "DELETE") {
        elements.deleteDialogStatus.textContent = copy.wrongConfirmation;
        elements.deleteConfirm.focus();
        return;
    }
    try {
        elements.deleteDialogConfirm.disabled = true;
        elements.deleteAccount.disabled = true;
        elements.deleteDialogStatus.textContent = copy.reauth;
        await reauthenticateForDeletion(user);
        elements.deleteDialogStatus.textContent = copy.deleting;
        await accountApi("/", { method: "DELETE", body: JSON.stringify({ confirmation: "DELETE" }) });
        localStorage.removeItem(THEME_STORAGE_KEY);
        localStorage.removeItem("ofek-ai-language");
        await signOut(auth);
        window.location.replace("/auth.html?deleted=1");
    } catch (error) {
        elements.deleteDialogStatus.textContent = error.message || "Could not delete your account.";
        elements.deleteAccount.disabled = false;
        elements.deleteDialogConfirm.disabled = false;
    }
}

function renderSocialPhoto(profile = {}, user = activeUser) {
    const source = profile.photoURL || user?.photoURL || "";
    if (elements.socialPhotoPreview && source) {
        elements.socialPhotoPreview.src = source;
        elements.socialPhotoPreview.hidden = false;
        if (elements.socialPhotoFallback) elements.socialPhotoFallback.hidden = true;
    } else {
        if (elements.socialPhotoPreview) elements.socialPhotoPreview.hidden = true;
        if (elements.socialPhotoFallback) {
            elements.socialPhotoFallback.hidden = false;
            elements.socialPhotoFallback.textContent = (profile.initials || "FP").slice(0, 3);
        }
    }
}

async function loadSocialProfile(user) {
    try {
        const data = await socialApi("/identity");
        loadedSocialProfile = data.profile || null;
        setInputValue(elements.socialDisplayName, loadedSocialProfile?.displayName || user.displayName || "");
        setInputValue(elements.socialUsername, loadedSocialProfile?.username || "");
        setInputValue(elements.socialBio, loadedSocialProfile?.bio || "");
        renderSocialPhoto(loadedSocialProfile || {}, user);
    } catch (error) {
        loadedSocialProfile = null;
        renderSocialPhoto({}, user);
        console.warn("Could not load Social profile settings:", error.message);
    }
}

async function saveSocialProfile(user) {
    const username = normalizeText(elements.socialUsername?.value);
    const displayName = normalizeText(elements.socialDisplayName?.value) || normalizeText(elements.fullName?.value) || user.displayName || username;
    if (!username) return null;
    const file = elements.socialPhoto?.files?.[0];
    let photoURL = loadedSocialProfile?.photoURL || user.photoURL || "";
    if (file) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Profile photos must be JPEG, PNG or WebP.");
        if (file.size > 5 * 1024 * 1024) throw new Error("Profile photos must be 5 MB or smaller.");
        const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
        const upload = await directImageKitUpload({
            file,
            fileName: `profile-${user.uid}.${extension}`,
            folder: `/fuelphysique/users/${user.uid}/social-profile`,
            isPrivateFile: false,
            tags: ["social-profile"]
        });
        photoURL = upload.url || upload.filePath || photoURL;
    }
    const body = { username, displayName, bio: elements.socialBio?.value || "", photoURL };
    const data = await socialApi(loadedSocialProfile ? "/profile" : "/identity/username", { method: "PUT", body: JSON.stringify(body) });
    loadedSocialProfile = data.profile || loadedSocialProfile;
    clearUsernameError();
    renderSocialPhoto(loadedSocialProfile || {}, user);
    return loadedSocialProfile;
}

function getSelectedTheme() {
    return (
        elements.theme?.value ||
        loadedSettings.theme ||
        "system"
    );
}

function resolveTheme(theme) {
    if (theme === "dark" || theme === "light") {
        return theme;
    }

    return window.matchMedia(
        "(prefers-color-scheme: dark)"
    ).matches
        ? "dark"
        : "light";
}

function applyTheme(
    theme = "system",
    persistLocally = true
) {
    const normalizedTheme = [
        "dark",
        "light",
        "system"
    ].includes(theme)
        ? theme
        : "system";

    const resolvedTheme =
        resolveTheme(normalizedTheme);

    const root = document.documentElement;

    root.dataset.theme = resolvedTheme;
    root.dataset.themePreference =
        normalizedTheme;

    root.style.colorScheme = resolvedTheme;

    document.body?.classList.toggle(
        "dark-theme",
        resolvedTheme === "dark"
    );

    document.body?.classList.toggle(
        "light-theme",
        resolvedTheme === "light"
    );

    if (persistLocally) {
        localStorage.setItem(
            THEME_STORAGE_KEY,
            normalizedTheme
        );
    }

    window.dispatchEvent(
        new CustomEvent(
            "ofekai:theme-changed",
            {
                detail: {
                    preference:
                        normalizedTheme,
                    theme:
                        resolvedTheme
                }
            }
        )
    );

    if (
        elements.theme &&
        elements.theme.value !== normalizedTheme
    ) {
        elements.theme.value =
            normalizedTheme;
    }
}

function bindSystemThemeListener() {
    systemThemeQuery = window.matchMedia(
        "(prefers-color-scheme: dark)"
    );

    systemThemeQuery.addEventListener?.(
        "change",
        () => {
            if (getSelectedTheme() === "system") {
                applyTheme("system", false);
            }
        }
    );
}

function applyStoredThemeImmediately() {
    const storedTheme =
        localStorage.getItem(
            THEME_STORAGE_KEY
        ) || "dark";

    applyTheme(storedTheme, false);
}

function openSettings() {
    if (!elements.overlay) {
        return;
    }

    elements.overlay.classList.add("show");

    elements.overlay.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.style.overflow =
        "hidden";
}

function closeSettings() {
    if (!elements.overlay) {
        return;
    }

    elements.overlay.classList.remove("show");

    elements.overlay.setAttribute(
        "aria-hidden",
        "true"
    );

    document.body.style.overflow = "";

    clearStatus();

    if (settingsOpenedAsPage) {
        window.location.href = "/dashboard.html";
    }
}

function activateTab(tab) {
    const pageId = tab?.dataset?.page;

    if (!pageId) {
        return;
    }

    tabs.forEach((item) => {
        const isActive = item === tab;
                item.classList.toggle(
            "active",
            isActive
        );

        item.setAttribute(
            "aria-selected",
            String(isActive)
        );
    });

    pages.forEach((page) => {
        page.classList.toggle(
            "active",
            page.id === pageId
        );
    });
}

function getStatusElement() {
    let status = document.getElementById(
        "settingsStatus"
    );

    if (
        !status &&
        elements.saveBtn?.parentElement
    ) {
        status =
            document.createElement("div");

        status.id = "settingsStatus";

        status.setAttribute(
            "role",
            "status"
        );

        status.setAttribute(
            "aria-live",
            "polite"
        );

        status.style.marginRight = "auto";
        status.style.fontSize = "0.9rem";
        status.style.fontWeight = "600";

        elements.saveBtn.parentElement.prepend(
            status
        );
    }

    return status;
}

function setStatus(
    message,
    type = "info"
) {
    const status = getStatusElement();

    if (!status) {
        return;
    }

    status.textContent = message;
    status.dataset.type = type;

    if (type === "success") {
        status.style.color = "#59ad78";
    } else if (type === "error") {
        status.style.color = "#ef4444";
    } else {
        status.style.color = "";
    }
}

function clearStatus() {
    const status = document.getElementById(
        "settingsStatus"
    );

    if (status) {
        status.textContent = "";

        status.removeAttribute(
            "data-type"
        );

        status.style.color = "";
    }
}

function setSavingState(saving) {
    isSaving = saving;

    if (!elements.saveBtn) {
        return;
    }

    if (
        !elements.saveBtn.dataset
            .originalText
    ) {
        elements.saveBtn.dataset.originalText =
            elements.saveBtn.textContent
                ?.trim() ||
            "Save Changes";
    }

    elements.saveBtn.disabled = saving;

    elements.saveBtn.setAttribute(
        "aria-busy",
        String(saving)
    );

elements.saveBtn.textContent = saving
    ? t(
          localStorage.getItem("ofek-ai-language") || "en",
          "saving"
      )
    : elements.saveBtn.dataset.originalText;
}

function collectSettings() {
    return {
        displayName: normalizeText(
            elements.fullName?.value
        ),

        email: normalizeText(
            elements.email?.value
        ),

        athleteCore: {
            age: numberOrNull(
                elements.age?.value
            ),

            weight: numberOrNull(
                elements.weight?.value
            ),

            height: numberOrNull(
                elements.height?.value
            ),

            experience:
                elements.experience
                    ?.value || "",

            goal:
                elements.goal?.value ||
                "",

            limitations: normalizeText(
                elements.limitations?.value
            ),

            trainingDays: numberOrNull(
                elements.trainingDays?.value
            ),

            trainingStyle:
                elements.trainingStyle?.value || "",

            equipment: normalizeText(
                elements.equipment?.value
            ),

            favoriteFoods: normalizeText(
                elements.favoriteFoods?.value
            ),

            dislikedFoods: normalizeText(
                elements.dislikedFoods?.value
            ),

            dietaryRestrictions: normalizeText(
                elements.dietaryRestrictions?.value
            ),

            personalNotes: normalizeText(
                elements.personalNotes?.value
            )
        },

        aiPreferences: {
            responseDepth:
                elements.responseDepth
                    ?.value ||
                "balanced",

            coachingStyle:
                elements.coachingStyle
                    ?.value ||
                "supportive",

            useAthleteCore:
                booleanValue(
                    elements.useAthleteCore,
                    true
                ),

            evidenceBased:
                booleanValue(
                    elements.evidenceBased,
                    true
                )
        },

        language:
            elements.language?.value ||
            "en",

        theme:
            elements.theme?.value ||
            "dark"
    };
}

function populateSettings(
    user,
    settings = {}
) {
    const athleteCore =
        settings.athleteCore || {};

    const aiPreferences =
        settings.aiPreferences || {};

    setInputValue(
        elements.fullName,
        settings.displayName ||
            user?.displayName ||
            ""
    );

    setInputValue(
        elements.email,
        user?.email ||
            settings.email ||
            ""
    );

    if (elements.email) {
        elements.email.readOnly = true;

        elements.email.setAttribute(
            "aria-readonly",
            "true"
        );
    }

    setInputValue(
        elements.age,
        athleteCore.age
    );

    setInputValue(
        elements.weight,
        athleteCore.weight
    );

    setInputValue(
        elements.height,
        athleteCore.height
    );

    setInputValue(
        elements.experience,
        athleteCore.experience
    );

    setInputValue(
        elements.goal,
        athleteCore.goal
    );

    setInputValue(
        elements.limitations,
        athleteCore.limitations
    );

    setInputValue(elements.trainingDays, athleteCore.trainingDays);
    setInputValue(elements.trainingStyle, athleteCore.trainingStyle);
    setInputValue(elements.equipment, athleteCore.equipment);
    setInputValue(elements.favoriteFoods, athleteCore.favoriteFoods);
    setInputValue(elements.dislikedFoods, athleteCore.dislikedFoods);
    setInputValue(elements.dietaryRestrictions, athleteCore.dietaryRestrictions);
    setInputValue(elements.personalNotes, athleteCore.personalNotes);

    setInputValue(
        elements.responseDepth,
        aiPreferences.responseDepth ||
            "balanced"
    );

    setInputValue(
        elements.coachingStyle,
        aiPreferences.coachingStyle ||
            "supportive"
    );

    setCheckboxValue(
        elements.useAthleteCore,
        aiPreferences.useAthleteCore ??
            true
    );

    setCheckboxValue(
        elements.evidenceBased,
        aiPreferences.evidenceBased ??
            true
    );

    setInputValue(
        elements.language,
        settings.language || "en"
    );

    setInputValue(
        elements.theme,
        settings.theme || "system"
    );

    applyTheme(
        settings.theme || "system"
    );

    localizeAccountSettings();

    updateDisplayedName(
        settings.displayName ||
            user?.displayName ||
            ""
    );
}

function updateDisplayedName(
    displayName
) {
    const cleanName =
        normalizeText(displayName);

    if (!cleanName) {
        return;
    }

    const selectors = [
        "[data-user-name]",
        "#userName",
        "#profileName",
        "#sidebarUserName",
        ".user-name"
    ];

    document
        .querySelectorAll(
            selectors.join(",")
        )
        .forEach((element) => {
            element.textContent =
                cleanName;
        });

    document.dispatchEvent(
        new CustomEvent(
            "ofekai:display-name-updated",
            {
                detail: {
                    displayName: cleanName
                }
            }
        )
    );
}

async function loadSettings(user) {
    if (!user) {
        return;
    }

    clearStatus();

    try {
        const snapshot = await getDoc(
            SETTINGS_DOC_PATH(user.uid)
        );

        loadedSettings =
            snapshot.exists()
                ? snapshot.data()
                : {};

        populateSettings(
            user,
            loadedSettings
        );
        await loadSocialProfile(user);
        window.dispatchEvent(
            new CustomEvent(
                "ofekai:settings-loaded",
                {
                    detail: {
                        ...loadedSettings,
                        email: user.email || "",
                        displayName:
                            loadedSettings.displayName ||
                            user.displayName ||
                            ""
                    }
                }
            )
        );
    } catch (error) {
        console.error(
            "Failed to load settings:",
            error
        );

        loadedSettings = {};

        populateSettings(user, {});

        setStatus(
            "Could not load your saved settings.",
            "error"
        );
    }
}

async function saveSettings() {
    if (isSaving) {
        return;
    }

    const user =
        auth.currentUser ||
        activeUser;

    if (!user) {
        setStatus(
            "You must be signed in to save settings.",
            "error"
        );

        return;
    }

    const settings =
        collectSettings();

    if (!settings.displayName) {
        setStatus(
            "Please enter your full name.",
            "error"
        );

        elements.fullName?.focus();

        return;
    }

    setSavingState(true);

    setStatus(
        "Saving settings..."
    );

    try {
        const payload = {
            ...settings,

            email:
                user.email ||
                settings.email ||
                "",

            updatedAt:
                serverTimestamp()
        };

        if (
            !loadedSettings.createdAt
        ) {
            payload.createdAt =
                serverTimestamp();
        }

        await setDoc(
            SETTINGS_DOC_PATH(
                user.uid
            ),
            payload,
            {
                merge: true
            }
        );

        await saveSocialProfile(user);

        if (
            user.displayName !==
            settings.displayName
        ) {
            await updateProfile(
                user,
                {
                    displayName:
                        settings.displayName
                }
            );
        }

        loadedSettings = {
            ...loadedSettings,
            ...settings,
            email: payload.email
        };

        applyTheme(
            settings.theme
        );

        localStorage.setItem(
            "ofek-ai-language",
            settings.language
        );

        updateDisplayedName(
            settings.displayName
        );

        window.dispatchEvent(
            new CustomEvent(
                "ofekai:settings-saved",
                {
                    detail: {
                        ...settings,
                        language: settings.language
                    }
                }
            )
        );
        setStatus(
            "Settings saved successfully.",
            "success"
        );
    } catch (error) {
        console.error(
            "Failed to save settings:",
            error
        );

        if (["username_taken", "invalid_username", "username_required", "username_state_conflict"].includes(error.code)) {
            setUsernameError(error);
            setStatus("", "info");
            elements.socialUsername?.focus();
        } else {
            setStatus(
                "Saving failed. Please try again.",
                "error"
            );
        }
    } finally {
        setSavingState(false);
    }
}

function bindEvents() {
    elements.openBtn?.addEventListener(
        "click",
        openSettings
    );

    elements.closeBtn?.addEventListener(
        "click",
        closeSettings
    );

    elements.cancelBtn?.addEventListener(
        "click",
        closeSettings
    );

    elements.saveBtn?.addEventListener(
        "click",
        saveSettings
    );

    elements.exportAccount?.addEventListener("click", exportAccount);
    elements.deleteAccount?.addEventListener("click", openDeleteAccountDialog);
    elements.deleteDialogCancel?.addEventListener("click", () => elements.deleteDialog.close());
    elements.deleteForm?.addEventListener("submit", (event) => { event.preventDefault(); deleteAccount(); });

    elements.overlay?.addEventListener(
        "click",
        (event) => {
            if (
                event.target ===
                elements.overlay
            ) {
                closeSettings();
            }
        }
    );

    document.addEventListener(
        "keydown",
        (event) => {
            if (
                event.key ===
                "Escape"
            ) {
                closeSettings();
            }

            if (
                (
                    event.ctrlKey ||
                    event.metaKey
                ) &&
                event.key.toLowerCase() ===
                    "s" &&
                elements.overlay
                    ?.classList.contains(
                        "show"
                    )
            ) {
                event.preventDefault();

                saveSettings();
            }
        }
    );

    tabs.forEach((tab) => {
        tab.addEventListener(
            "click",
            () => {
                activateTab(tab);
            }
        );
    });

    elements.theme?.addEventListener(
        "change",
        () => {
            applyTheme(
                elements.theme.value
            );
        }
    );

    elements.language?.addEventListener("change", localizeAccountSettings);

    elements.socialPhoto?.addEventListener("change", () => {
        const file = elements.socialPhoto.files?.[0];
        if (!file) return renderSocialPhoto(loadedSocialProfile || {}, activeUser);
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
            setStatus("Choose a JPEG, PNG or WebP image up to 5 MB.", "error");
            elements.socialPhoto.value = "";
            return;
        }
        const previewUrl = URL.createObjectURL(file);
        if (elements.socialPhotoPreview) {
            elements.socialPhotoPreview.src = previewUrl;
            elements.socialPhotoPreview.hidden = false;
        }
        if (elements.socialPhotoFallback) elements.socialPhotoFallback.hidden = true;
    });

    elements.socialUsername?.addEventListener("input", clearUsernameError);
}

applyStoredThemeImmediately();

bindSystemThemeListener();

bindEvents();

if (settingsOpenedAsPage) {
    document.body.classList.add("settings-page-mode");
    openSettings();
    const initialTab = tabs.find(
        (tab) => tab.dataset.page === `${settingsInitialSection}Settings`
    );
    if (initialTab) {
        activateTab(initialTab);
    }
    window.history.replaceState({}, "", window.location.pathname);
}

onAuthStateChanged(
    auth,
    async (user) => {
        activeUser = user;

        if (!user) {
            loadedSettings = {};

            populateSettings(
                null,
                {
                    theme:
                        localStorage.getItem(
                            THEME_STORAGE_KEY
                        ) ||
                        "dark"
                }
            );

            return;
        }

        // app-auth.js (loaded on the same page) owns the visible
        // verification gate; this guard exists so settings.js's own
        // independent Firestore read/write never runs ahead of that
        // decision -- app-auth.js hiding the body is not sufficient on its
        // own, since this module has its own onAuthStateChanged and would
        // otherwise fetch/write user data regardless of page visibility.
        if (shouldBlockUnverifiedAccess(user)) {
            return;
        }

        await loadSettings(user);
    }
);

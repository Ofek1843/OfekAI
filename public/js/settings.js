import { auth, db } from "./firebase-config.js";
import { t } from "./i18n.js";
import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import {
    onAuthStateChanged,
    updateProfile
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

/*
 * TrainIQ AI — Settings Controller
 * Firestore path: users/{uid}/settings/main
 */

const SETTINGS_DOC_PATH = (uid) =>
    doc(db, "users", uid, "settings", "main");

const THEME_STORAGE_KEY = "ofek-ai-theme";

const elements = {
    overlay: document.getElementById("settingsOverlay"),
    openBtn: document.getElementById("settingsBtn"),
    closeBtn: document.getElementById("closeSettingsBtn"),
    cancelBtn: document.getElementById("cancelSettingsBtn"),
    saveBtn: document.getElementById("saveSettingsBtn"),

    fullName: document.getElementById("settingsFullName"),
    email: document.getElementById("settingsEmail"),
    age: document.getElementById("settingsAge"),
    weight: document.getElementById("settingsWeight"),
    height: document.getElementById("settingsHeight"),
    experience: document.getElementById("settingsExperience"),
    goal: document.getElementById("settingsGoal"),
    limitations: document.getElementById("settingsLimitations"),

    responseDepth: document.getElementById("settingsResponseDepth"),
    coachingStyle: document.getElementById("settingsCoachingStyle"),
    useAthleteCore: document.getElementById(
        "settingsUseAthleteCore"
    ),
    evidenceBased: document.getElementById(
        "settingsEvidenceBased"
    ),

    language: document.getElementById("settingsLanguage"),
    theme: document.getElementById("settingsTheme")
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

function normalizeText(value) {
    return typeof value === "string"
        ? value.trim()
        : "";
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
        ) || "system";

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
        status.style.color = "#22c55e";
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
            "system"
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

        setStatus(
            "Saving failed. Please try again.",
            "error"
        );
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
}

applyStoredThemeImmediately();

bindSystemThemeListener();

bindEvents();

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
                        "system"
                }
            );

            return;
        }

        await loadSettings(user);
    }
);
import { auth, db } from "./firebase-config.js";
import { trackEvent } from "./analytics.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const DEFAULT_ATHLETE_CORE = {
  goal: "",
  trainingLevel: "",
  weight: "",
  height: "",
  trainingDays: "",
  trainingStyle: [],
  limitations: "",
  notes: ""
};

let currentUser = null;
let athleteCoreCache = { ...DEFAULT_ATHLETE_CORE };

function getUserRef(userId) {
  return doc(db, "users", userId);
}

function getAthleteCoreRef(userId) {
  return doc(
    db,
    "users",
    userId,
    "athleteCore",
    "main"
  );
}

function normalizeAthleteCore(data = {}) {
  return {
    goal:
      typeof data.goal === "string"
        ? data.goal
        : "",

    trainingLevel:
      typeof data.trainingLevel === "string"
        ? data.trainingLevel
        : "",

    weight:
      data.weight ?? "",

    height:
      data.height ?? "",

    trainingDays:
      data.trainingDays ?? "",

    trainingStyle:
      Array.isArray(data.trainingStyle)
        ? data.trainingStyle
        : [],

    limitations:
      typeof data.limitations === "string"
        ? data.limitations
        : "",

    notes:
      typeof data.notes === "string"
        ? data.notes
        : ""
  };
}

async function ensureUserProfile(user) {
  const userRef = getUserRef(user.uid);
  const userSnapshot = await getDoc(userRef);

  if (!userSnapshot.exists()) {
    await setDoc(userRef, {
      email: user.email || "",
      displayName: user.displayName || "",
      plan: "free",
      onboardingCompletedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    console.log("Firestore user profile created");
    return;
  }

  await setDoc(
    userRef,
    {
      email: user.email || "",
      displayName: user.displayName || "",
      updatedAt: serverTimestamp()
    },
    {
      merge: true
    }
  );

  console.log("Firestore user profile updated");
}

async function ensureAthleteCore(userId) {
  const athleteCoreRef = getAthleteCoreRef(userId);
  const athleteCoreSnapshot =
    await getDoc(athleteCoreRef);

  if (!athleteCoreSnapshot.exists()) {
    await setDoc(athleteCoreRef, {
      ...DEFAULT_ATHLETE_CORE,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    athleteCoreCache = {
      ...DEFAULT_ATHLETE_CORE
    };

    console.log("Athlete Core created");
    return athleteCoreCache;
  }

  athleteCoreCache = normalizeAthleteCore(
    athleteCoreSnapshot.data()
  );

  console.log("Athlete Core loaded");

  return athleteCoreCache;
}

export async function getAthleteCore() {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("User must be signed in.");
  }

  const athleteCoreRef = getAthleteCoreRef(
    user.uid
  );

  const athleteCoreSnapshot =
    await getDoc(athleteCoreRef);

  if (!athleteCoreSnapshot.exists()) {
    return ensureAthleteCore(user.uid);
  }

  athleteCoreCache = normalizeAthleteCore(
    athleteCoreSnapshot.data()
  );

  return athleteCoreCache;
}

export async function saveAthleteCore(data = {}) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("User must be signed in.");
  }

  const cleanData = normalizeAthleteCore(data);

  const numericWeight =
    cleanData.weight === ""
      ? ""
      : Number(cleanData.weight);

  const numericHeight =
    cleanData.height === ""
      ? ""
      : Number(cleanData.height);

  const numericTrainingDays =
    cleanData.trainingDays === ""
      ? ""
      : Number(cleanData.trainingDays);

  if (
    numericWeight !== "" &&
    (
      !Number.isFinite(numericWeight) ||
      numericWeight <= 0
    )
  ) {
    throw new Error(
      "Weight must be a positive number."
    );
  }

  if (
    numericHeight !== "" &&
    (
      !Number.isFinite(numericHeight) ||
      numericHeight <= 0
    )
  ) {
    throw new Error(
      "Height must be a positive number."
    );
  }

  if (
    numericTrainingDays !== "" &&
    (
      !Number.isInteger(numericTrainingDays) ||
      numericTrainingDays < 0 ||
      numericTrainingDays > 7
    )
  ) {
    throw new Error(
      "Training days must be between 0 and 7."
    );
  }

  athleteCoreCache = {
    ...cleanData,
    weight: numericWeight,
    height: numericHeight,
    trainingDays: numericTrainingDays
  };

  const athleteCoreRef = getAthleteCoreRef(
    user.uid
  );

  const userRef = getUserRef(user.uid);
  const userSnapshot = await getDoc(userRef);
  const completedOnboarding = Boolean(userSnapshot.exists() && userSnapshot.data()?.onboardingCompletedAt);

  await setDoc(
    athleteCoreRef,
    {
      ...athleteCoreCache,
      updatedAt: serverTimestamp()
    },
    {
      merge: true
    }
  );

  if (!completedOnboarding) {
    await setDoc(userRef, {
      onboardingCompletedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    trackEvent("onboarding_completed", {
      source: "athlete_core"
    });
  }

  window.dispatchEvent(
    new CustomEvent("athlete-core-updated", {
      detail: {
        athleteCore: athleteCoreCache
      }
    })
  );

  return athleteCoreCache;
}

export function getCachedAthleteCore() {
  return {
    ...athleteCoreCache,
    trainingStyle: [
      ...athleteCoreCache.trainingStyle
    ]
  };
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (!user) {
    athleteCoreCache = {
      ...DEFAULT_ATHLETE_CORE
    };

    return;
  }

  try {
    await ensureUserProfile(user);

    const athleteCore =
      await ensureAthleteCore(user.uid);

    window.dispatchEvent(
      new CustomEvent("athlete-core-loaded", {
        detail: {
          athleteCore
        }
      })
    );
  } catch (error) {
    console.error(
      "Firestore profile error:",
      error
    );
  }
});

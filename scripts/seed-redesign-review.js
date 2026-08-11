#!/usr/bin/env node
"use strict";

const { Timestamp } = require("firebase-admin/firestore");

const PROJECT_ID = "demo-fuelphysique";
const AUTH_HOST = "127.0.0.1:9099";
const FIRESTORE_HOST = "127.0.0.1:8080";
const TERMS_VERSION = "2026-08-08";

const USERS = [
  {
    uid: "review-athlete-a",
    email: "review-athlete-a@example.test",
    password: "FuelReview-2026-A!",
    displayName: "Maya Review",
    username: "maya.performance",
    locale: "en",
  },
  {
    uid: "review-athlete-b",
    email: "review-athlete-b@example.test",
    password: "FuelReview-2026-B!",
    displayName: "נועם ריוויו",
    username: "noam.moves",
    locale: "he",
  },
];

const SOCIAL_CONTACTS = [
  { uid: "review-athlete-c", displayName: "Lena Brooks", username: "lena.lifts", locale: "en" },
  { uid: "review-athlete-d", displayName: "Daniel Pace", username: "daniel.pace", locale: "en" },
  { uid: "review-athlete-e", displayName: "Roni Strength", username: "roni.strength", locale: "en" },
];

function assertLocalEnvironment() {
  const actual = {
    project: process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT,
    auth: process.env.FIREBASE_AUTH_EMULATOR_HOST,
    firestore: process.env.FIRESTORE_EMULATOR_HOST,
  };
  if (actual.project !== PROJECT_ID || actual.auth !== AUTH_HOST || actual.firestore !== FIRESTORE_HOST) {
    throw new Error(`Refusing to seed outside the isolated review emulators: ${JSON.stringify(actual)}`);
  }
}

function daysAgo(days, hour = 18) {
  const value = new Date();
  value.setDate(value.getDate() - days);
  value.setHours(hour, 0, 0, 0);
  return Timestamp.fromDate(value);
}

function dateKey(days) {
  const value = new Date();
  value.setDate(value.getDate() - days);
  return value.toISOString().slice(0, 10);
}

function workoutPlan(locale) {
  const he = locale === "he";
  const plan = {
    programName: he ? "תוכנית כוח מדויקת" : "Ultramarine Strength Cycle",
    durationWeeks: 8,
    daysPerWeek: 4,
    weeklyScheduleDays: [1, 3, 5, 6],
    muscleFocusMode: "prioritize",
    selectedMuscles: ["chest", "back", "quads"],
    sessions: [
      {
        name: he ? "פלג גוף עליון — כוח" : "Upper — strength",
        exercises: [
          { exerciseId: "barbell-bench-press", name: he ? "לחיצת חזה" : "Barbell Bench Press", muscleGroup: "Chest", equipment: "Barbell", sets: 4, reps: "5-7", restSeconds: 150, rir: 2 },
          { exerciseId: "lat-pulldown", name: he ? "משיכת פולי עליון" : "Lat Pulldown", muscleGroup: "Back", equipment: "Cable", sets: 4, reps: "8-10", restSeconds: 120, rir: 2 },
          { exerciseId: "dumbbell-shoulder-press", name: he ? "לחיצת כתפיים" : "Dumbbell Shoulder Press", muscleGroup: "Delts", equipment: "Dumbbell", sets: 3, reps: "8-10", restSeconds: 90, rir: 2 },
        ],
      },
      {
        name: he ? "פלג גוף תחתון — ביצועים" : "Lower — performance",
        exercises: [
          { exerciseId: "back-squat", name: he ? "סקוואט" : "Back Squat", muscleGroup: "Quads", equipment: "Barbell", sets: 4, reps: "6-8", restSeconds: 180, rir: 2 },
          { exerciseId: "romanian-deadlift", name: he ? "דדליפט רומני" : "Romanian Deadlift", muscleGroup: "Hamstrings", equipment: "Barbell", sets: 3, reps: "8-10", restSeconds: 150, rir: 2 },
          { exerciseId: "leg-press", name: he ? "לחיצת רגליים" : "Leg Press", muscleGroup: "Quads", equipment: "Machine", sets: 3, reps: "10-12", restSeconds: 120, rir: 2 },
        ],
      },
      {
        name: he ? "עליון — נפח" : "Upper — volume",
        exercises: [
          { exerciseId: "incline-dumbbell-press", name: he ? "לחיצה בשיפוע" : "Incline Dumbbell Press", muscleGroup: "Chest", equipment: "Dumbbell", sets: 3, reps: "8-12", restSeconds: 90, rir: 2 },
          { exerciseId: "seated-cable-row", name: he ? "חתירה בישיבה" : "Seated Cable Row", muscleGroup: "Back", equipment: "Cable", sets: 4, reps: "8-12", restSeconds: 90, rir: 2 },
          { exerciseId: "cable-lateral-raise", name: he ? "הרחקת כתפיים" : "Cable Lateral Raise", muscleGroup: "Delts", equipment: "Cable", sets: 3, reps: "12-15", restSeconds: 60, rir: 2 },
        ],
      },
      {
        name: he ? "תחתון — נפח" : "Lower — volume",
        exercises: [
          { exerciseId: "front-squat", name: he ? "פרונט סקוואט" : "Front Squat", muscleGroup: "Quads", equipment: "Barbell", sets: 3, reps: "8-10", restSeconds: 150, rir: 2 },
          { exerciseId: "lying-leg-curl", name: he ? "כפיפת ברך" : "Lying Leg Curl", muscleGroup: "Hamstrings", equipment: "Machine", sets: 3, reps: "10-12", restSeconds: 90, rir: 2 },
          { exerciseId: "standing-calf-raise", name: he ? "תאומים בעמידה" : "Standing Calf Raise", muscleGroup: "Calves", equipment: "Machine", sets: 4, reps: "10-15", restSeconds: 60, rir: 2 },
        ],
      },
    ],
  };
  plan.sessions = plan.sessions.map((session, index) => ({ ...session, day: index + 1 }));
  return plan;
}

function nutritionPlan(locale) {
  const he = locale === "he";
  return {
    planName: he ? "תפריט ביצועים מאוזן" : "Performance Fuel Plan",
    dailyCalories: locale === "he" ? 2380 : 2240,
    proteinGrams: locale === "he" ? 168 : 156,
    carbsGrams: locale === "he" ? 286 : 272,
    fatGrams: locale === "he" ? 68 : 64,
    meals: [
      { mealNumber: 1, slot: "breakfast", title: he ? "יוגורט, שיבולת שועל ופירות" : "Greek yogurt, oats and berries", calories: 510, proteinGrams: 38, carbsGrams: 64, fatGrams: 12 },
      { mealNumber: 2, slot: "lunch", title: he ? "עוף, אורז וירקות" : "Chicken, rice and vegetables", calories: 690, proteinGrams: 52, carbsGrams: 82, fatGrams: 16 },
      { mealNumber: 3, slot: "snack", title: he ? "בננה ושייק חלבון" : "Banana and protein shake", calories: 310, proteinGrams: 28, carbsGrams: 42, fatGrams: 4 },
      { mealNumber: 4, slot: "dinner", title: he ? "סלמון, קינואה ואספרגוס" : "Salmon, quinoa and asparagus", calories: 730, proteinGrams: 38, carbsGrams: 84, fatGrams: 28 },
    ],
  };
}

function socialProfile(user) {
  const initials = String(user.displayName || user.username)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => Array.from(part)[0] || "")
    .join("")
    .toUpperCase();
  return {
    uid: user.uid,
    username: user.username,
    usernameLower: user.username,
    displayName: user.displayName,
    initials: initials || "FP",
    photoURL: "",
    bio: user.locale === "he" ? "מתאמן בעקביות ובכוונה." : "Training with intent. Building measurable momentum.",
    publicRole: "athlete",
    badges: ["athlete", "consistent"],
    discoverable: true,
    allowFriendRequests: true,
  };
}

async function clearFirestoreEmulator() {
  const response = await fetch(`http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: "DELETE" });
  if (!response.ok) throw new Error(`Could not clear the local Firestore emulator (${response.status}).`);
}

async function seed() {
  assertLocalEnvironment();
  await clearFirestoreEmulator();
  const { getFuelPhysiqueAuth, getFuelPhysiqueFirestore } = require("../lib/firebase-admin");
  const auth = getFuelPhysiqueAuth();
  const db = getFuelPhysiqueFirestore();

  for (const user of USERS) {
    try { await auth.deleteUser(user.uid); } catch (error) { if (error.code !== "auth/user-not-found") throw error; }
    await auth.createUser({
      uid: user.uid,
      email: user.email,
      password: user.password,
      displayName: user.displayName,
      emailVerified: true,
      disabled: false,
    });
  }

  const [userA, userB] = USERS;
  const conversationId = [userA.uid, userB.uid].sort().map(encodeURIComponent).join("__");
  const batch = db.batch();

  for (const [index, user] of USERS.entries()) {
    const workoutId = `review-workout-${user.locale}`;
    const nutritionId = `review-nutrition-${user.locale}`;
    const plan = workoutPlan(user.locale);
    const nutrition = nutritionPlan(user.locale);
    batch.set(db.doc(`users/${user.uid}`), {
      uid: user.uid,
      email: user.email,
      emailVerified: true,
      displayName: user.displayName,
      language: user.locale,
      termsAccepted: true,
      termsVersion: TERMS_VERSION,
      privacyVersion: TERMS_VERSION,
      termsAcceptedAt: daysAgo(1),
      activeWorkoutPlanId: workoutId,
      activeNutritionPlanId: nutritionId,
      subscription: { planId: "free", status: "active" },
      createdAt: daysAgo(120),
      updatedAt: daysAgo(0),
    });
    batch.set(db.doc(`users/${user.uid}/settings/main`), {
      displayName: user.displayName,
      language: user.locale,
      theme: "light",
      athleteCore: {
        age: index === 0 ? 29 : 32,
        gender: index === 0 ? "female" : "male",
        height: index === 0 ? 168 : 181,
        weight: index === 0 ? 64.8 : 82.4,
        experience: "intermediate",
        goal: "muscle-gain",
        trainingDays: 4,
        activityLevel: "active",
        trainingStyle: "gym",
        equipment: "Full gym, barbells, dumbbells and cable stations",
        dietaryRestrictions: "None",
        favoriteFoods: "Greek yogurt, oats, chicken, rice and berries",
        dislikedFoods: "None",
        limitations: "None",
      },
      updatedAt: daysAgo(0),
    });
    batch.set(db.doc(`users/${user.uid}/workoutPlans/${workoutId}`), { name: plan.programName, plan, sourceType: "generated", createdAt: daysAgo(35), updatedAt: daysAgo(2) });
    batch.set(db.doc(`users/${user.uid}/nutritionPlans/${nutritionId}`), { name: nutrition.planName, plan: nutrition, sourceType: "manual", createdAt: daysAgo(22), updatedAt: daysAgo(1) });
    batch.set(db.doc(`socialProfiles/${user.uid}`), socialProfile(user));
    batch.set(db.doc(`usernames/${user.username}`), { uid: user.uid, usernameLower: user.username });
    batch.set(db.doc(`notificationPreferences/${user.uid}`), {
      uid: user.uid,
      notificationsEnabled: false,
      newMessages: true,
      sharedPlans: true,
      friendActivity: true,
      workoutReminders: true,
      showMessagePreviews: false,
      reminderTime: index === 0 ? "18:30" : "19:00",
      timezone: "Asia/Jerusalem",
      locale: user.locale,
      updatedAt: daysAgo(0),
    });

    const logExercises = plan.sessions[0].exercises.map((exercise, exerciseIndex) => ({
      name: exercise.name,
      exerciseId: exercise.exerciseId,
      sets: Array.from({ length: Math.min(3, exercise.sets) }, (_, setIndex) => ({ completed: true, weightKg: 32 + exerciseIndex * 12 + setIndex * 2.5, reps: 8 + setIndex, rpe: 8 })),
    }));
    for (let logIndex = 0; logIndex < 5; logIndex += 1) {
      const completedAt = daysAgo(logIndex * 2, 18);
      batch.set(db.doc(`users/${user.uid}/workoutLogs/review-log-${logIndex}`), {
        workoutPlanId: workoutId,
        workoutName: plan.sessions[logIndex % plan.sessions.length].name,
        planName: plan.programName,
        sessionIndex: logIndex % plan.sessions.length,
        durationMinutes: 52 + logIndex,
        completedSets: 10 + logIndex,
        exercises: logExercises,
        exerciseLogs: logExercises,
        startedAt: Timestamp.fromMillis(completedAt.toMillis() - 54 * 60 * 1000),
        completedAt,
        createdAt: completedAt,
      });
    }
    [0, 7, 14, 21, 28, 35].forEach((days, entryIndex) => {
      batch.set(db.doc(`users/${user.uid}/weightEntries/review-weight-${entryIndex}`), {
        weight: (index === 0 ? 64.8 : 82.4) - (5 - entryIndex) * 0.24,
        date: dateKey(days),
        createdAt: daysAgo(days, 8),
      });
    });
    batch.set(db.doc(`users/${user.uid}/bodyMeasurements/review-latest`), {
      chest: index === 0 ? 92 : 104,
      waist: index === 0 ? 72 : 84,
      hips: index === 0 ? 98 : 101,
      arm: index === 0 ? 31 : 37,
      thigh: index === 0 ? 56 : 62,
      date: dateKey(3),
      measuredAt: daysAgo(3),
      createdAt: daysAgo(3),
    });
  }

  for (const contact of SOCIAL_CONTACTS) {
    batch.set(db.doc(`users/${contact.uid}`), { uid: contact.uid, displayName: contact.displayName, language: contact.locale, termsAccepted: true, termsVersion: TERMS_VERSION, createdAt: daysAgo(90), updatedAt: daysAgo(0) });
    batch.set(db.doc(`socialProfiles/${contact.uid}`), socialProfile(contact));
    batch.set(db.doc(`usernames/${contact.username}`), { uid: contact.uid, usernameLower: contact.username });
  }

  batch.set(db.doc(`friendships/${conversationId}`), { participants: [userA.uid, userB.uid].sort(), status: "accepted", createdAt: daysAgo(70), updatedAt: daysAgo(0) });
  batch.set(db.doc(`conversations/${conversationId}`), {
    participants: [userA.uid, userB.uid].sort(),
    participantKey: conversationId,
    status: "active",
    schemaVersion: 1,
    lastMessagePreview: "Recovery session looks good — see you Thursday.",
    lastMessageSenderUid: userB.uid,
    lastMessageAt: daysAgo(0),
    createdAt: daysAgo(60),
    updatedAt: daysAgo(0),
  });
  for (const user of USERS) {
    const other = USERS.find((candidate) => candidate.uid !== user.uid);
    batch.set(db.doc(`users/${user.uid}/conversationSummaries/${conversationId}`), {
      conversationId,
      otherUid: other.uid,
      status: "active",
      unreadCount: user.uid === userA.uid ? 1 : 0,
      lastMessagePreview: "Recovery session looks good — see you Thursday.",
      lastMessageSenderUid: userB.uid,
      lastMessageAt: daysAgo(0),
      updatedAt: daysAgo(0),
    });
  }
  const messages = [
    { id: "review-message-1", senderUid: userA.uid, type: "text", text: "Strong lower session today. I kept the final set at RIR 2.", createdAt: daysAgo(1, 18) },
    { id: "review-message-2", senderUid: userB.uid, type: "text", text: "Nice. I shared the nutrition setup I use on training days.", createdAt: daysAgo(1, 19) },
    { id: "review-message-3", senderUid: userA.uid, type: "voice", voice: { assetId: "local-review-unavailable", durationMs: 6200, mimeType: "audio/webm", sizeBytes: 18000, unavailable: true }, createdAt: daysAgo(1, 20) },
    { id: "review-message-4", senderUid: userB.uid, type: "text", text: "Recovery session looks good — see you Thursday.", createdAt: daysAgo(0) },
  ];
  messages.forEach((message) => batch.set(db.doc(`conversations/${conversationId}/messages/${message.id}`), { ...message, clientId: message.id, schemaVersion: 1 }));
  batch.set(db.doc(`conversations/${conversationId}/messages/review-music-1`), { type: "music_link", music: { provider: "spotify", title: "Heavy day focus", url: "https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP" }, senderUid: userA.uid, clientId: "review-music-1", schemaVersion: 1, createdAt: daysAgo(1, 17) });
  batch.set(db.doc(`conversations/${conversationId}/messages/review-music-2`), { type: "music_link", music: { provider: "youtube_music", title: "Recovery tempo", url: "https://music.youtube.com/watch?v=dQw4w9WgXcQ" }, senderUid: userB.uid, clientId: "review-music-2", schemaVersion: 1, createdAt: daysAgo(0, 16) });

  const contactC = SOCIAL_CONTACTS[0];
  const secondConversationId = [userA.uid, contactC.uid].sort().map(encodeURIComponent).join("__");
  batch.set(db.doc(`friendships/${secondConversationId}`), { participants: [userA.uid, contactC.uid].sort(), status: "accepted", acceptedAt: daysAgo(45), createdAt: daysAgo(48), updatedAt: daysAgo(3) });
  batch.set(db.doc(`conversations/${secondConversationId}`), { participants: [userA.uid, contactC.uid].sort(), participantKey: secondConversationId, status: "active", schemaVersion: 1, lastMessagePreview: "Your Day 3 volume looks balanced.", lastMessageSenderUid: contactC.uid, lastMessageAt: daysAgo(3), createdAt: daysAgo(40), updatedAt: daysAgo(3) });
  batch.set(db.doc(`users/${userA.uid}/conversationSummaries/${secondConversationId}`), { conversationId: secondConversationId, otherUid: contactC.uid, status: "active", unreadCount: 0, lastMessagePreview: "Your Day 3 volume looks balanced.", lastMessageSenderUid: contactC.uid, lastMessageAt: daysAgo(3), updatedAt: daysAgo(3) });
  batch.set(db.doc(`users/${contactC.uid}/conversationSummaries/${secondConversationId}`), { conversationId: secondConversationId, otherUid: userA.uid, status: "active", unreadCount: 0, lastMessagePreview: "Your Day 3 volume looks balanced.", lastMessageSenderUid: contactC.uid, lastMessageAt: daysAgo(3), updatedAt: daysAgo(3) });
  batch.set(db.doc(`conversations/${secondConversationId}/messages/review-message-c1`), { senderUid: userA.uid, type: "text", text: "I moved Day 3 to Friday — does the volume still look right?", clientId: "review-message-c1", schemaVersion: 1, createdAt: daysAgo(3, 17) });
  batch.set(db.doc(`conversations/${secondConversationId}/messages/review-message-c2`), { senderUid: contactC.uid, type: "text", text: "Your Day 3 volume looks balanced.", clientId: "review-message-c2", schemaVersion: 1, createdAt: daysAgo(3, 18) });

  const receivedContact = SOCIAL_CONTACTS[1];
  const sentContact = SOCIAL_CONTACTS[2];
  const receivedRequestId = [userA.uid, receivedContact.uid].sort().map(encodeURIComponent).join("__");
  const sentRequestId = [userA.uid, sentContact.uid].sort().map(encodeURIComponent).join("__");
  batch.set(db.doc(`friendRequests/${receivedRequestId}`), { requestId: receivedRequestId, fromUid: receivedContact.uid, toUid: userA.uid, participants: [receivedContact.uid, userA.uid].sort(), status: "pending", schemaVersion: 1, createdAt: daysAgo(2), updatedAt: daysAgo(2) });
  batch.set(db.doc(`friendRequests/${sentRequestId}`), { requestId: sentRequestId, fromUid: userA.uid, toUid: sentContact.uid, participants: [userA.uid, sentContact.uid].sort(), status: "pending", schemaVersion: 1, createdAt: daysAgo(4), updatedAt: daysAgo(4) });

  batch.set(db.doc("sharedArtifacts/review-workout-share"), {
    ownerUid: userA.uid,
    recipientIds: [userB.uid],
    conversationId,
    type: "workout",
    schemaVersion: 1,
    snapshot: { title: "Ultramarine Strength Cycle", sessions: workoutPlan("en").sessions.slice(0, 2) },
    revokedAt: null,
    createdAt: daysAgo(2),
  });
  batch.set(db.doc("sharedArtifacts/review-nutrition-share"), {
    ownerUid: userB.uid,
    recipientIds: [userA.uid],
    conversationId,
    type: "nutrition",
    schemaVersion: 1,
    snapshot: { title: "Performance Fuel Plan", ...nutritionPlan("he") },
    revokedAt: null,
    createdAt: daysAgo(2),
  });
  batch.set(db.doc(`conversations/${conversationId}/messages/review-artifact-1`), { type: "artifact", artifactType: "workout", artifactId: "review-workout-share", senderUid: userA.uid, clientId: "review-artifact-1", schemaVersion: 1, createdAt: daysAgo(2) });
  batch.set(db.doc(`conversations/${conversationId}/messages/review-artifact-2`), { type: "artifact", artifactType: "nutrition", artifactId: "review-nutrition-share", senderUid: userB.uid, clientId: "review-artifact-2", schemaVersion: 1, createdAt: daysAgo(2) });

  await batch.commit();
  console.log(JSON.stringify({ projectId: PROJECT_ID, users: USERS.map(({ uid, email, locale }) => ({ uid, email, locale })), conversationIds: [conversationId, secondConversationId], seededMusicMessages: 2, receivedRequests: 1, sentRequests: 1 }, null, 2));
}

seed().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

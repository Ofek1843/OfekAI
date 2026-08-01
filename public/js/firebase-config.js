import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
  connectAuthEmulator,
  getAuth
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  connectFirestoreEmulator,
  getFirestore
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import {
  getStorage
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-storage.js";

import { resolveAuthDomain } from "./firebase-environment.mjs";

const localEmulatorMode = ["localhost", "127.0.0.1"].includes(window.location.hostname);

// apiKey/projectId/appId/storageBucket/messagingSenderId/measurementId are
// NOT environment-dependent and must never change here -- only authDomain
// varies, and only because Google's OAuth consent screen displays it
// verbatim ("Continue to {authDomain}"). See firebase-environment.mjs for
// why production uses fuelphysique.com (via the /__/auth/* reverse proxy in
// server.js) while every other hostname uses the Firebase project domain.
const firebaseConfig = {
  apiKey: "AIzaSyB5EAK98RQP_LNd0fgj3UtCwE17lwXTADU",
  authDomain: resolveAuthDomain(window.location.hostname),
  projectId: localEmulatorMode ? "demo-fuelphysique" : "ofek-ai-55f1d",
  storageBucket: "ofek-ai-55f1d.firebasestorage.app",
  messagingSenderId: "644398760036",
  appId: "1:644398760036:web:aa34bd6a283d686560df71",
  measurementId: "G-1HG905SBV4"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Loopback pages are never production pages, so all local navigation stays on
// the emulators even when a protected-page redirect drops the query string.
if (localEmulatorMode) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

export { auth, db, storage };

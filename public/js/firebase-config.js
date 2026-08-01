import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import {
  getStorage
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-storage.js";

import { resolveAuthDomain } from "./firebase-environment.mjs";

// apiKey/projectId/appId/storageBucket/messagingSenderId/measurementId are
// NOT environment-dependent and must never change here -- only authDomain
// varies, and only because Google's OAuth consent screen displays it
// verbatim ("Continue to {authDomain}"). See firebase-environment.mjs for
// why production uses fuelphysique.com (via the /__/auth/* reverse proxy in
// server.js) while every other hostname uses the Firebase project domain.
const firebaseConfig = {
  apiKey: "AIzaSyB5EAK98RQP_LNd0fgj3UtCwE17lwXTADU",
  authDomain: resolveAuthDomain(window.location.hostname),
  projectId: "ofek-ai-55f1d",
  storageBucket: "ofek-ai-55f1d.firebasestorage.app",
  messagingSenderId: "644398760036",
  appId: "1:644398760036:web:aa34bd6a283d686560df71",
  measurementId: "G-1HG905SBV4"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };

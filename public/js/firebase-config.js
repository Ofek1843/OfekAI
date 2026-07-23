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

const firebaseConfig = {
  apiKey: "AIzaSyB5EAK98RQP_LNd0fgj3UtCwE17lwXTADU",
  authDomain: "ofek-ai-55f1d.firebaseapp.com",
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

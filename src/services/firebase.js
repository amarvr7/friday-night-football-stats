import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// --- 1. FIREBASE INITIALIZATION ---
// Hardcoded configuration to ensure immediate availability
const firebaseConfig = {
  apiKey: "AIzaSyCst0JAHFRVNmq_PTDVciV7pwF3MW-6TVY",
  authDomain: "fridaynightfootball-ba9c1.firebaseapp.com",
  projectId: "fridaynightfootball-ba9c1",
  storageBucket: "fridaynightfootball-ba9c1.firebasestorage.app",
  messagingSenderId: "149039714412",
  appId: "1:149039714412:web:a6422e99116ef923100849",
  measurementId: "G-YTVXVQ8328"
};

// Singleton initialization pattern to prevent multiple instances
let app;
let auth;
let db;

try {
  // Check if an app is already initialized
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp(); // Use existing default app
  }

  // Initialize services
  auth = getAuth(app);
  db = getFirestore(app);
  console.log("Firebase Initialized Successfully");
} catch (err) {
  console.error("Firebase Init Error:", err);
}

// Database references
const PROJECT_ID = "fridaynightfootball-ba9c1";
const COLLECTIONS = {
  PLAYERS: 'players',
  MATCHES: 'matches',
  SETTINGS: 'settings',
  CHECKINS: 'checkins'
};

const ACCESS_CODE_PLAYER = "FRIDAY";
const ACCESS_CODE_ADMIN = "ADMIN123";

export { app, auth, db, COLLECTIONS, PROJECT_ID, ACCESS_CODE_PLAYER, ACCESS_CODE_ADMIN };

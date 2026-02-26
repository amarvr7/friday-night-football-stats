require('dotenv').config();
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const PROJECT_ID = process.env.REACT_APP_FIREBASE_PROJECT_ID; 

async function fixAgge() {
  const playersRef = collection(db, 'artifacts', PROJECT_ID, 'public', 'data', 'players');
  const snap = await getDocs(playersRef);
  let aggeDoc = null;
  snap.forEach(d => {
      if(d.data().name.toLowerCase() === 'agge') {
          aggeDoc = d;
      }
  });

  if (aggeDoc) {
      console.log("Fixing Agge with ID:", aggeDoc.id);
      const ref = doc(db, 'artifacts', PROJECT_ID, 'public', 'data', 'players', aggeDoc.id);
      await updateDoc(ref, {
          gamesPlayed: 20,
          goals: 15,
          wins: 12,
          assists: 0,
          cleanSheets: 0,
          motms: 0
      });
      console.log("Agge fixed in DB.");
  } else {
      console.log("Agge not found!");
  }
  process.exit(0);
}

fixAgge();

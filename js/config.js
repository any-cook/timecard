const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyDcZlJdZJKeW3FILKMz7x_a5tXExFpcgao",
  authDomain:        "timecard-web-aac6e.firebaseapp.com",
  projectId:         "timecard-web-aac6e",
  storageBucket:     "timecard-web-aac6e.firebasestorage.app",
  messagingSenderId: "275551647409",
  appId:             "1:275551647409:web:a1348e6ab28ae060f15490"
};

const ADMIN_PIN = '1234';

const DEMO_MODE = (FIREBASE_CONFIG.apiKey === 'YOUR_API_KEY');

let _db = null;

function getDB() {
  if (_db) return _db;
  if (DEMO_MODE) return null;
  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }
  _db = firebase.firestore();
  return _db;
}

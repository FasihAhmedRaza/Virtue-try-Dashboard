import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDtIK8Fhstr7MWtSTrk2Jyg8-kibkJBG7w",
  authDomain: "expense-tracker-dbc4f.firebaseapp.com",
  projectId: "expense-tracker-dbc4f",
  storageBucket: "expense-tracker-dbc4f.firebasestorage.app",
  messagingSenderId: "962554904093",
  appId: "1:962554904093:web:4050f7ad4c35d4da24d0f4",
  measurementId: "G-EFF1NY9H5X"
};


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
export const firestore = getFirestore(app);

// ✅ Add this:
const auth = getAuth(app);
signInAnonymously(auth)
  .then(() => console.log("Signed in anonymously"))
  .catch((error) => console.error("Auth error:", error));


export { db };
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Expensify-inspired brutalist architecture Firebase Client Bootstrap
// Connects to Project AURA's Firebase environment
const firebaseConfig = {
  apiKey: "AIzaSyBvxCMyLp_pp8fJvR_8o5fSJyEE6DsSf44", // Using the correct Firebase API key provided by user
  authDomain: "aura-86e0e.firebaseapp.com",
  projectId: "aura-86e0e",
  storageBucket: "aura-86e0e.appspot.com",
  messagingSenderId: "374829103847",
  appId: "1:374829103847:web:8c5bde893a207bc29de8ff"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);

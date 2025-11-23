import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as firebaseSignOut } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Wrapper for signOut that also clears testing tokens
const signOut = async (authInstance: typeof auth) => {
  // Clear testing tokens if they exist
  localStorage.removeItem("TESTING_AUTH_TOKEN");
  localStorage.removeItem("TESTING_AUTH_EMAIL");
  localStorage.removeItem("TESTING_AUTH_USER");
  return firebaseSignOut(authInstance);
};

export { app, auth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut };
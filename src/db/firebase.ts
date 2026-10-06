import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
  projectId: "gen-lang-client-0631640025",
  appId: "1:741745624092:web:975ff2a787765996760bd9",
  apiKey: "AIzaSyCau6-c4BhJOoZLstWCCbhu2fYx5_lZ0eA",
  authDomain: "gen-lang-client-0631640025.firebaseapp.com",
  storageBucket: "gen-lang-client-0631640025.firebasestorage.app",
  messagingSenderId: "741745624092",
};

const app = initializeApp(firebaseConfig);

let firestoreInstance: any;
try {
  firestoreInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  }, "ai-studio-77b32e73-4355-4202-b52b-d1541ad1eaeb");
} catch (e) {
  firestoreInstance = getFirestore(app, "ai-studio-77b32e73-4355-4202-b52b-d1541ad1eaeb");
}

export const db = firestoreInstance;
export const storage = getStorage(app);
storage.maxUploadRetryTime = 2500; // 2.5 seconds max upload retry limit for super fast response
storage.maxOperationRetryTime = 2500; // 2.5 seconds max operation retry limit
export const auth = getAuth(app);

// Sign in anonymously to authenticate the session for Firebase Storage and Firestore rules
signInAnonymously(auth)
  .then(() => {
    console.log("Firebase Auth: Signed in anonymously successfully.");
  })
  .catch((err) => {
    console.warn("Firebase Auth: Anonymous sign-in failed (make sure Anonymous Auth is enabled in Firebase Console):", err);
  });

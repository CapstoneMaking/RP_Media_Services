// src/pages/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD9tMYYbrrIeg8IzJr6HsmSLTQkrpPS6O0",
  authDomain: "userlogindb-76260.firebaseapp.com",
  databaseURL: "https://userlogindb-76260-default-rtdb.firebaseio.com",
  projectId: "userlogindb-76260",
  storageBucket: "userlogindb-76260.firebasestorage.app",
  messagingSenderId: "1010679264774",
  appId: "1:1010679264774:web:780f788497e943015b7587"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const provider = new GoogleAuthProvider();

// Set persistence
setPersistence(auth, browserLocalPersistence);

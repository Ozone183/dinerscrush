import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBBiAUhia89ERb39h68l-xZFiSNZxy-tP8",
  authDomain: "dinerscrush-8588e.firebaseapp.com",
  projectId: "dinerscrush-8588e",
  storageBucket: "dinerscrush-8588e.firebasestorage.app",
  messagingSenderId: "535629324020",
  appId: "1:535629324020:web:3b79295642ae33322608a1",
  measurementId: "G-06DMK03Z34"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

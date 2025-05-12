// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database"; // Correct import for Realtime Database
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDybpAfjXc5xckiYOyzHhUBptSPzqRyLDA",
  authDomain: "bells-attend.firebaseapp.com",
  projectId: "bells-attend",
  storageBucket: "bells-attend.firebasestorage.app",
  messagingSenderId: "495166978663",
  appId: "1:495166978663:web:9e52cb7acd7425354d72c2",
  measurementId: "G-FY4N8JDLWW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);


export const auth = getAuth(app);
export const db = getFirestore(app);
export const database = getDatabase(app); 
export const firestore = getFirestore(app);
export default app;  
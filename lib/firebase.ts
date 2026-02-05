import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDt1OimFrzyQRi3gjmB1oh3oJgX0lzo_dY",
  authDomain: "dirtyshirleyapp.firebaseapp.com",
  projectId: "dirtyshirleyapp",
  storageBucket: "dirtyshirleyapp.firebasestorage.app",
  messagingSenderId: "630900920976",
  appId: "1:630900920976:web:82706b8cb6b46cd8e13e15",
  measurementId: "G-G0D959S3N9"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
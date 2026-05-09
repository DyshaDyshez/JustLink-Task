import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCz0vGpRTOJxxiLzQU93PN34pvYhuUpxno",
    authDomain: "justlink-task.firebaseapp.com",
    projectId: "justlink-task",
    storageBucket: "justlink-task.firebasestorage.app",
    messagingSenderId: "330324597396",
    appId: "1:330324597396:web:fce9b687c11d7c8d2e7281"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
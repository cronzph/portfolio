// Firebase Configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

const firebaseConfig = {
    apiKey: "AIzaSyDdph8zC6lXC7V7Z3RKYYUSOjfJ_AGy-QY",
    authDomain: "portfolio-b60f9.firebaseapp.com",
    databaseURL: "https://portfolio-b60f9-default-rtdb.firebaseio.com",
    projectId: "portfolio-b60f9",
    storageBucket: "portfolio-b60f9.firebasestorage.app",
    messagingSenderId: "292004537866",
    appId: "1:292004537866:web:b0393ee5e0b8c7a05e61f3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

export { auth, database };

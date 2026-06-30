import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
    apiKey: "AIzaSyDdph8zC6lXC7V7Z3RKYYUSOjfJ_AGy-QY",
    authDomain: "portfolio-b60f9.firebaseapp.com",
    databaseURL: "https://portfolio-b60f9-default-rtdb.firebaseio.com",
    projectId: "portfolio-b60f9",
    storageBucket: "portfolio-b60f9.firebasestorage.app",
    messagingSenderId: "292004537866",
    appId: "1:292004537866:web:b0393ee5e0b8c7a05e61f3"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);

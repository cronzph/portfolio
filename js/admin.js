// Admin Login JavaScript
import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// If already logged in, redirect to dashboard
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            window.location.href = 'dashboard.html';
        }
    });

    setupLoginForm();
});

function setupLoginForm() {
    const form = document.getElementById('loginForm');
    const errorDiv = document.getElementById('loginError');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const submitBtn = form.querySelector('button[type="submit"]');

        submitBtn.disabled = true;
        submitBtn.textContent = 'Logging in...';
        errorDiv.innerHTML = '';

        try {
            await signInWithEmailAndPassword(auth, email, password);
            errorDiv.innerHTML = '<div class="success">Login successful! Redirecting...</div>';
            window.location.href = 'dashboard.html';
        } catch (error) {
            let errorMessage = 'Login failed. Please try again.';
            console.error('Firebase error:', error.code, error.message);

            switch (error.code) {
                case 'auth/invalid-email':
                    errorMessage = 'Invalid email address format.';
                    break;
                case 'auth/user-disabled':
                    errorMessage = 'This account has been disabled.';
                    break;
                case 'auth/user-not-found':
                    errorMessage = 'No account found with this email.';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Incorrect password. Please try again.';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Too many attempts. Please try again later.';
                    break;
                case 'auth/invalid-credential':
                    errorMessage = 'Invalid credentials. Please check your email and password.';
                    break;
                case 'auth/network-request-failed':
                    errorMessage = 'Network error. Please check your internet connection.';
                    break;
                default:
                    errorMessage = `Login failed: ${error.message}`;
            }

            errorDiv.innerHTML = `<div class="error">${errorMessage}</div>`;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Login';
        }
    });
}

// Admin Dashboard JavaScript
import { auth, database } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { ref, push, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

let currentUser = null;
let selectedFile = null;

// Make functions globally available
window.logout = logout;
window.resetForm = resetForm;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupAuthStateListener();
    setupLoginForm();
    setupPostForm();
    setupFileInput();
});

// Auth state observer
function setupAuthStateListener() {
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        
        if (user) {
            showView('adminView');
            document.getElementById('userEmail').textContent = user.email;
            loadStats();
        } else {
            // Redirect to login if not authenticated
            showView('loginView');
        }
    });
}

// Show specific view
function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

// Login form handler
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
        } catch (error) {
            let errorMessage = 'Login failed. Please try again.';
            
            if (error.code === 'auth/invalid-email') {
                errorMessage = 'Invalid email address.';
            } else if (error.code === 'auth/user-not-found') {
                errorMessage = 'No account found with this email.';
            } else if (error.code === 'auth/wrong-password') {
                errorMessage = 'Incorrect password.';
            } else if (error.code === 'auth/invalid-credential') {
                errorMessage = 'Invalid credentials. Please check your email and password.';
            }
            
            errorDiv.innerHTML = `<div class="error">${errorMessage}</div>`;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Login';
        }
    });
}

// Logout function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        signOut(auth).then(() => {
            window.location.href = 'admin.html';
        }).catch((error) => {
            console.error('Logout error:', error);
        });
    }
}

// File input handler
function setupFileInput() {
    const fileInput = document.getElementById('fileInput');
    const fileName = document.getElementById('fileName');

    fileInput.addEventListener('change', (e) => {
        selectedFile = e.target.files[0];
        if (selectedFile) {
            const maxSize = 1 * 1024 * 1024; // 1MB
            if (selectedFile.size > maxSize) {
                alert('File size must be less than 1MB');
                fileInput.value = '';
                selectedFile = null;
                fileName.textContent = 'Click to select an image or drag and drop';
                return;
            }

            if (!selectedFile.type.startsWith('image/')) {
                alert('Only image files are supported');
                fileInput.value = '';
                selectedFile = null;
                fileName.textContent = 'Click to select an image or drag and drop';
                return;
            }

            fileName.textContent = selectedFile.name;
        } else {
            fileName.textContent = 'Click to select an image or drag and drop';
        }
    });
}

// Post form handler
function setupPostForm() {
    const form = document.getElementById('postForm');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) return;

        const title = document.getElementById('postTitle').value.trim();
        const category = document.getElementById('postCategory').value;
        const description = document.getElementById('postDescription').value.trim();
        const messageDiv = document.getElementById('formMessage');
        const submitBtn = document.getElementById('submitBtn');
        const submitBtnText = document.getElementById('submitBtnText');

        submitBtn.disabled = true;
        submitBtnText.textContent = 'Creating...';
        messageDiv.innerHTML = '';

        try {
            let imageData = null;
            let fileName = null;

            if (selectedFile) {
                const result = await convertToBase64(selectedFile);
                imageData = result.data;
                fileName = result.name;
            }

            const postData = {
                title,
                category,
                description,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            if (imageData) {
                postData.imageData = imageData;
                postData.imageName = fileName;
            }

            await push(ref(database, 'posts'), postData);
            messageDiv.innerHTML = '<div class="success">✓ Post created successfully!</div>';

            resetForm();
            loadStats();
            
            setTimeout(() => {
                messageDiv.innerHTML = '';
            }, 3000);

        } catch (error) {
            console.error('Error saving post:', error);
            messageDiv.innerHTML = `<div class="error">✗ Error: ${error.message}</div>`;
        } finally {
            submitBtn.disabled = false;
            submitBtnText.textContent = 'Create Post';
        }
    });
}

// Convert file to Base64
function convertToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        const progressDiv = document.getElementById('uploadProgress');
        const progressBar = document.getElementById('uploadProgressBar');
        const progressText = document.getElementById('uploadProgressText');

        progressDiv.classList.add('active');

        reader.onload = (e) => {
            progressDiv.classList.remove('active');
            resolve({
                data: e.target.result,
                name: file.name
            });
        };

        reader.onerror = (error) => {
            progressDiv.classList.remove('active');
            reject(error);
        };

        reader.onprogress = (e) => {
            if (e.lengthComputable) {
                const progress = (e.loaded / e.total) * 100;
                progressBar.style.width = progress + '%';
                progressText.textContent = Math.round(progress) + '%';
            }
        };

        reader.readAsDataURL(file);
    });
}

// Load stats
function loadStats() {
    const postsRef = ref(database, 'posts');
    
    onValue(postsRef, (snapshot) => {
        if (!snapshot.exists()) {
            document.getElementById('totalPosts').textContent = '0';
            document.getElementById('postsWithImages').textContent = '0';
            document.getElementById('recentPosts').textContent = '0';
            return;
        }

        const posts = [];
        snapshot.forEach((childSnapshot) => {
            posts.push(childSnapshot.val());
        });

        // Total posts
        document.getElementById('totalPosts').textContent = posts.length;

        // Posts with images
        const withImages = posts.filter(p => p.imageData).length;
        document.getElementById('postsWithImages').textContent = withImages;

        // Recent posts (last 7 days)
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const recent = posts.filter(p => p.createdAt >= sevenDaysAgo).length;
        document.getElementById('recentPosts').textContent = recent;
    });
}

// Reset form
function resetForm() {
    document.getElementById('postForm').reset();
    document.getElementById('fileName').textContent = 'Click to select an image or drag and drop';
    document.getElementById('formTitle').textContent = 'Create New Post';
    document.getElementById('submitBtnText').textContent = 'Create Post';
    document.getElementById('cancelBtn').style.display = 'none';
    document.getElementById('formMessage').innerHTML = '';
    document.getElementById('uploadProgress').classList.remove('active');
    selectedFile = null;
}
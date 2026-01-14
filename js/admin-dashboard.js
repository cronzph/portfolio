// Admin Dashboard JavaScript
import { auth, database } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

let currentUser = null;
let postsChart = null;
let categoryChart = null;

// Make functions globally available
window.logout = logout;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Hide both views initially to prevent flash
    document.getElementById('loginView').style.display = 'none';
    document.getElementById('adminView').style.display = 'none';
    
    setupAuthStateListener();
    setupLoginForm();
});

// Auth state observer
function setupAuthStateListener() {
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        
        if (user) {
            showView('adminView');
            document.getElementById('userEmail').textContent = user.email;
            loadStats();
            loadRecentPosts();
        } else {
            showView('loginView');
        }
    });
}

// Show specific view
function showView(viewId) {
    const loginView = document.getElementById('loginView');
    const adminView = document.getElementById('adminView');
    
    if (viewId === 'adminView') {
        loginView.style.display = 'none';
        loginView.classList.remove('active');
        adminView.style.display = 'flex';
        adminView.classList.add('active');
    } else {
        adminView.style.display = 'none';
        adminView.classList.remove('active');
        loginView.style.display = 'flex';
        loginView.classList.add('active');
    }
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

// Load stats and initialize charts
function loadStats() {
    const postsRef = ref(database, 'posts');
    
    onValue(postsRef, (snapshot) => {
        if (!snapshot.exists()) {
            document.getElementById('totalPosts').textContent = '0';
            document.getElementById('totalImages').textContent = '0';
            document.getElementById('recentPosts').textContent = '0';
            document.getElementById('totalViews').textContent = '0';
            
            // Initialize empty charts
            initializeCharts([], []);
            return;
        }

        const posts = [];
        snapshot.forEach((childSnapshot) => {
            const postData = childSnapshot.val();
            posts.push({
                id: childSnapshot.key,
                ...postData
            });
        });

        // Total posts
        document.getElementById('totalPosts').textContent = posts.length;

        // Total images
        const totalImages = posts.reduce((sum, post) => sum + (post.imageCount || 0), 0);
        document.getElementById('totalImages').textContent = totalImages;

        // Recent posts (last 7 days)
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const recentPostsCount = posts.filter(p => p.createdAt >= sevenDaysAgo).length;
        document.getElementById('recentPosts').textContent = recentPostsCount;

        // Total views
        const totalViews = posts.reduce((sum, p) => sum + (p.views || 0), 0);
        document.getElementById('totalViews').textContent = totalViews;

        // Prepare data for charts
        const monthlyData = getMonthlyPostsData(posts);
        const categoryData = getCategoryData(posts);

        // Initialize charts with data
        initializeCharts(monthlyData, categoryData);
    });
}

// Get monthly posts data for line chart
function getMonthlyPostsData(posts) {
    const months = {};
    const now = new Date();
    
    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        months[key] = 0;
    }
    
    // Count posts per month
    posts.forEach(post => {
        const date = new Date(post.createdAt);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (months.hasOwnProperty(key)) {
            months[key]++;
        }
    });
    
    return Object.entries(months).map(([key, count]) => {
        const [year, month] = key.split('-');
        const date = new Date(year, parseInt(month) - 1);
        return {
            label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            count: count
        };
    });
}

// Get category data for pie chart
function getCategoryData(posts) {
    const categories = {};
    
    posts.forEach(post => {
        const category = post.category || 'Uncategorized';
        categories[category] = (categories[category] || 0) + 1;
    });
    
    return Object.entries(categories).map(([name, count]) => ({
        name,
        count
    }));
}

// Initialize charts
function initializeCharts(monthlyData, categoryData) {
    // Destroy existing charts if they exist
    if (postsChart) {
        postsChart.destroy();
    }
    if (categoryChart) {
        categoryChart.destroy();
    }

    // Posts Overview Chart (Line Chart)
    const postsCtx = document.getElementById('postsChart');
    if (postsCtx) {
        postsChart = new Chart(postsCtx, {
            type: 'line',
            data: {
                labels: monthlyData.map(d => d.label),
                datasets: [{
                    label: 'Posts Created',
                    data: monthlyData.map(d => d.count),
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    // Category Chart (Doughnut Chart)
    const categoryCtx = document.getElementById('categoryChart');
    if (categoryCtx) {
        categoryChart = new Chart(categoryCtx, {
            type: 'doughnut',
            data: {
                labels: categoryData.map(d => d.name),
                datasets: [{
                    data: categoryData.map(d => d.count),
                    backgroundColor: [
                        '#6366f1',
                        '#8b5cf6',
                        '#ec4899',
                        '#f59e0b',
                        '#10b981',
                        '#3b82f6'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 1.5,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom'
                    }
                }
            }
        });
    }
}

// Load recent posts
function loadRecentPosts() {
    const postsRef = ref(database, 'posts');
    const list = document.getElementById('recentPostsList');
    
    if (!list) {
        return;
    }
    
    onValue(postsRef, (snapshot) => {
        list.innerHTML = '';

        if (!snapshot.exists()) {
            list.innerHTML = '<div class="empty-state"><p>No posts yet. <a href="admin-posts.html" style="color: var(--accent-primary);">Create your first post!</a></p></div>';
            return;
        }

        const posts = [];
        snapshot.forEach((childSnapshot) => {
            posts.push({
                id: childSnapshot.key,
                ...childSnapshot.val()
            });
        });

        // Sort by newest first and take only 5
        posts.sort((a, b) => b.createdAt - a.createdAt);
        const recentPosts = posts.slice(0, 5);

        recentPosts.forEach(post => {
            const item = createRecentPostItem(post);
            list.appendChild(item);
        });
    });
}

// Create recent post item
function createRecentPostItem(post) {
    const item = document.createElement('div');
    item.className = 'recent-post-item';

    const date = new Date(post.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    const firstImage = post.images && post.images.length > 0 ? post.images[0].data : null;
    const imageCount = post.imageCount || 0;

    item.innerHTML = `
        <div class="recent-post-image">
            ${firstImage ? `
                <img src="${firstImage}" alt="${escapeHtml(post.title)}">
                ${imageCount > 1 ? `<span class="image-count">+${imageCount - 1}</span>` : ''}
            ` : '<div class="no-image-placeholder">📷</div>'}
        </div>
        <div class="recent-post-info">
            <h4>${escapeHtml(post.title)}</h4>
            <p>${escapeHtml(post.description.substring(0, 80))}${post.description.length > 80 ? '...' : ''}</p>
            <div class="recent-post-meta">
                <span class="post-category">${post.category}</span>
                <span class="post-date">${date}</span>
            </div>
        </div>
    `;

    item.onclick = () => {
        window.location.href = 'admin-posts.html';
    };

    return item;
}

// Escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
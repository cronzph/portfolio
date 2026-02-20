// Admin Dashboard JavaScript
import { auth, database } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import { loadSidebar } from './sidebar-loader.js';

let currentUser = null;
let postsChartInstance = null;
let categoryChartInstance = null;

// Make functions globally available
window.logout = logout;

const ALL_CATEGORIES = [
    'Web Development', 'Mobile Development', 'Arduino / IoT', 'Networking',
    'Cyber Security', 'IT Support', 'AI Automation', 'Game Development', 'Smart Systems',
];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupAuthStateListener();
    setupLoginForm();
});

// ── AUTH ──────────────────────────────────────────────────────────────────────
function setupAuthStateListener() {
    onAuthStateChanged(auth, async (user) => {
        currentUser = user;

        if (user) {
            await loadSidebar();
            showView('adminView');
            document.getElementById('userEmail').textContent = user.email;
            loadStats();
        } else {
            showView('loginView');
        }
    });
}

function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
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
            if (error.code === 'auth/invalid-email')           errorMessage = 'Invalid email address.';
            else if (error.code === 'auth/user-not-found')     errorMessage = 'No account found with this email.';
            else if (error.code === 'auth/wrong-password')     errorMessage = 'Incorrect password.';
            else if (error.code === 'auth/invalid-credential') errorMessage = 'Invalid credentials. Please check your email and password.';
            errorDiv.innerHTML = `<div class="error">${errorMessage}</div>`;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Login';
        }
    });
}

// ── LOGOUT ────────────────────────────────────────────────────────────────────
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        signOut(auth)
            .then(() => { window.location.href = 'admin.html'; })
            .catch(console.error);
    }
}

// ── STATS + CHARTS ────────────────────────────────────────────────────────────
function loadStats() {
    const postsRef = ref(database, 'posts');

    onValue(postsRef, (snapshot) => {
        if (!snapshot.exists()) {
            document.getElementById('totalPosts').textContent  = '0';
            document.getElementById('totalImages').textContent = '0';
            document.getElementById('recentPosts').textContent = '0';
            renderRecentPosts([]);
            renderPostsChart([]);
            renderCategoryChart({});
            return;
        }

        const posts = [];
        snapshot.forEach((child) => {
            posts.push({ id: child.key, ...child.val() });
        });

        // ── Stat cards ──────────────────────────────────────
        document.getElementById('totalPosts').textContent = posts.length;

        // Count posts that have a banner or any images
        const withImages = posts.filter(p => p.bannerImage || p.imageData || (p.images && p.images.length > 0)).length;
        document.getElementById('totalImages').textContent = withImages;

        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const recent = posts.filter(p => p.createdAt >= sevenDaysAgo).length;
        document.getElementById('recentPosts').textContent = recent;

        // ── Charts ──────────────────────────────────────────
        renderPostsChart(posts);
        renderCategoryChart(buildCategoryCounts(posts));

        // ── Recent posts list ───────────────────────────────
        const sorted = [...posts].sort((a, b) => b.createdAt - a.createdAt);
        renderRecentPosts(sorted.slice(0, 5));
    });
}

// Build category → count map, supports both single `category` and `categories` array
function buildCategoryCounts(posts) {
    const counts = {};
    ALL_CATEGORIES.forEach(cat => { counts[cat] = 0; });

    posts.forEach(post => {
        const cats = Array.isArray(post.categories)
            ? post.categories
            : (post.category ? [post.category] : []);
        cats.forEach(cat => {
            if (counts[cat] !== undefined) counts[cat]++;
            else counts[cat] = 1; // handle any unknown category gracefully
        });
    });

    return counts;
}

// ── POSTS OVERVIEW CHART (bar — posts per month, last 6 months) ──────────────
function renderPostsChart(posts) {
    const ctx = document.getElementById('postsChart');
    if (!ctx) return;

    // Build last 6 months labels + counts
    const months = [];
    const counts = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
        months.push(label);
        const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
        const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
        counts.push(posts.filter(p => p.createdAt >= start && p.createdAt <= end).length);
    }

    if (postsChartInstance) postsChartInstance.destroy();
    postsChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [{
                label: 'Posts',
                data: counts,
                backgroundColor: 'rgba(79,158,255,0.25)',
                borderColor: '#4f9eff',
                borderWidth: 2,
                borderRadius: 6,
            }],
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1, color: '#94a3b8' },
                    grid: { color: 'rgba(255,255,255,0.05)' },
                },
                x: {
                    ticks: { color: '#94a3b8' },
                    grid: { display: false },
                },
            },
        },
    });
}

// ── CATEGORY CHART (doughnut) ─────────────────────────────────────────────────
function renderCategoryChart(counts) {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;

    // Only show categories that have at least 1 post
    const labels = Object.keys(counts).filter(k => counts[k] > 0);
    const data   = labels.map(k => counts[k]);

    const COLORS = {
        'Web Development':    '#4f9eff',
        'Mobile Development': '#a78bfa',
        'Arduino / IoT':      '#34d399',
        'Networking':         '#f59e0b',
        'Cyber Security':     '#f87171',
        'IT Support':         '#60a5fa',
        'AI Automation':      '#e879f9',
        'Game Development':   '#fb923c',
        'Smart Systems':      '#2dd4bf',
    };
    const backgroundColors = labels.map(l => COLORS[l] || '#94a3b8');

    if (categoryChartInstance) categoryChartInstance.destroy();

    if (labels.length === 0) {
        // Nothing to show yet
        ctx.getContext('2d'); // keep canvas clean
        return;
    }

    categoryChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: backgroundColors.map(c => c + '99'), // 60% opacity fill
                borderColor:     backgroundColors,
                borderWidth: 2,
                hoverOffset: 6,
            }],
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#94a3b8',
                        padding: 12,
                        font: { size: 12 },
                        boxWidth: 12,
                        boxHeight: 12,
                    },
                },
            },
        },
    });
}

// ── RECENT POSTS LIST ─────────────────────────────────────────────────────────
function renderRecentPosts(posts) {
    const container = document.getElementById('recentPostsList');
    if (!container) return;

    if (posts.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No posts yet.</p></div>';
        return;
    }

    container.innerHTML = posts.map(post => {
        const date = new Date(post.createdAt).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
        });

        // Support both single category and categories array
        const cats = Array.isArray(post.categories)
            ? post.categories
            : (post.category ? [post.category] : []);
        const catBadges = cats
            .map(c => `<span class="post-list-category" style="margin-right:0.3rem;">${escapeHtml(c)}</span>`)
            .join('');

        const thumb = post.bannerImage?.data || post.imageData || null;

        return `
        <div style="display:flex;align-items:center;gap:1rem;padding:0.85rem 0;border-bottom:1px solid var(--border-color,rgba(255,255,255,0.07));">
            ${thumb
                ? `<img src="${thumb}" alt="${escapeHtml(post.title)}" style="width:64px;height:40px;object-fit:cover;border-radius:6px;flex-shrink:0;">`
                : `<div style="width:64px;height:40px;border-radius:6px;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;">📁</div>`
            }
            <div style="flex:1;min-width:0;">
                <p style="font-weight:600;color:var(--text-primary);margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(post.title)}</p>
                <div style="margin-top:0.25rem;">${catBadges}</div>
            </div>
            <span style="font-size:0.75rem;color:var(--text-secondary);white-space:nowrap;flex-shrink:0;">${date}</span>
        </div>`;
    }).join('');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
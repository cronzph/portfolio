// Admin Analytics JavaScript
import { auth, database } from './firebase-config.js';
import { signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import { loadSidebar } from './sidebar-loader.js';

let currentUser = null;
let allPosts = {};
let allViews = {};
let currentPeriod = 'all';
let customDateRange = { start: null, end: null };
let viewsTimeChart = null;

// Make functions globally available
window.logout = logout;
window.filterByPeriod = filterByPeriod;
window.applyCustomRange = applyCustomRange;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupAuthStateListener();
});

// ── AUTH ──────────────────────────────────────────────────────────────────────
function setupAuthStateListener() {
    onAuthStateChanged(auth, async (user) => {
        currentUser = user;
        if (user) {
            await loadSidebar();
            document.getElementById('userEmail').textContent = user.email;
            loadAnalytics();
        } else {
            window.location.href = 'admin.html';
        }
    });
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        signOut(auth)
            .then(() => { window.location.href = 'admin.html'; })
            .catch(console.error);
    }
}

// ── LOAD ANALYTICS ────────────────────────────────────────────────────────────
function loadAnalytics() {
    // Load posts first
    onValue(ref(database, 'posts'), (snapshot) => {
        allPosts = {};
        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                allPosts[child.key] = { id: child.key, ...child.val() };
            });
        }
        loadViews();
    });
}

function loadViews() {
    onValue(ref(database, 'views'), (snapshot) => {
        allViews = {};
        if (snapshot.exists()) {
            snapshot.forEach((postChild) => {
                const postId = postChild.key;
                allViews[postId] = [];
                
                postChild.forEach((viewChild) => {
                    const viewData = viewChild.val();
                    if (viewData && viewData.timestamp) {
                        allViews[postId].push({
                            id: viewChild.key,
                            ...viewData
                        });
                    }
                });
            });
        }
        
        console.log('All Views:', allViews);
        console.log('All Posts:', allPosts);
        
        calculateStats();
        renderViewsTimeChart();
        renderPostAnalytics();
    }, (error) => {
        console.error('Error loading views:', error);
        // Show posts anyway even if no views
        calculateStats();
        renderViewsTimeChart();
        renderPostAnalytics();
    });
}

// ── CALCULATE STATS ───────────────────────────────────────────────────────────
function calculateStats() {
    const now = Date.now();
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

    let totalViews = 0;
    let viewsToday = 0;
    let viewsThisMonth = 0;

    Object.values(allViews).forEach(views => {
        views.forEach(view => {
            totalViews++;
            if (view.timestamp >= todayStart) viewsToday++;
            if (view.timestamp >= monthStart) viewsThisMonth++;
        });
    });

    const postsWithViews = Object.keys(allViews).length;
    const avgViews = postsWithViews > 0 ? Math.round(totalViews / postsWithViews) : 0;

    document.getElementById('totalViews').textContent = totalViews.toLocaleString();
    document.getElementById('viewsToday').textContent = viewsToday.toLocaleString();
    document.getElementById('viewsThisMonth').textContent = viewsThisMonth.toLocaleString();
    document.getElementById('avgViewsPerPost').textContent = avgViews.toLocaleString();
}

// ── VIEWS OVER TIME CHART ─────────────────────────────────────────────────────
function renderViewsTimeChart() {
    const ctx = document.getElementById('viewsTimeChart');
    if (!ctx) return;

    // Last 30 days
    const days = [];
    const counts = [];
    
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        const dayStart = d.getTime();
        const dayEnd = new Date(d).setHours(23, 59, 59, 999);
        
        const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        days.push(label);
        
        let dayCount = 0;
        Object.values(allViews).forEach(views => {
            views.forEach(view => {
                if (view.timestamp >= dayStart && view.timestamp <= dayEnd) {
                    dayCount++;
                }
            });
        });
        counts.push(dayCount);
    }

    if (viewsTimeChart) viewsTimeChart.destroy();
    
    viewsTimeChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: days,
            datasets: [{
                label: 'Views',
                data: counts,
                backgroundColor: 'rgba(79, 158, 255, 0.1)',
                borderColor: '#4f9eff',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointBackgroundColor: '#4f9eff',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointHoverRadius: 5,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#4f9eff',
                    borderWidth: 1,
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { 
                        stepSize: 1, 
                        color: '#94a3b8',
                        font: { size: 11 }
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                },
                x: {
                    ticks: { 
                        color: '#94a3b8',
                        font: { size: 10 },
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: { display: false },
                }
            }
        }
    });
}

// ── RENDER POST ANALYTICS ─────────────────────────────────────────────────────
function renderPostAnalytics() {
    const container = document.getElementById('postAnalyticsList');
    if (!container) {
        console.error('Container not found');
        return;
    }

    const postStats = [];

    console.log('Rendering analytics for', Object.keys(allPosts).length, 'posts');

    Object.keys(allPosts).forEach(postId => {
        const post = allPosts[postId];
        const views = allViews[postId] || [];
        
        const filteredViews = filterViewsByPeriod(views, currentPeriod);
        
        postStats.push({
            post,
            totalViews: views.length,
            periodViews: filteredViews.length,
            views: filteredViews
        });
    });

    // Sort by total views (all time) first, then by period views
    postStats.sort((a, b) => {
        if (currentPeriod === 'all') {
            return b.totalViews - a.totalViews;
        }
        return b.periodViews - a.periodViews || b.totalViews - a.totalViews;
    });

    if (postStats.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No posts found. Create some posts first!</p></div>';
        return;
    }

    console.log('Rendering', postStats.length, 'post stats');

    container.innerHTML = postStats.map(stat => {
        const imageUrl = stat.post.bannerImage?.data || (stat.post.images && stat.post.images[0]?.data);
        const thumb = imageUrl
            ? `<img src="${imageUrl}" alt="${escapeHtml(stat.post.title)}" class="post-analytics-thumb">`
            : `<div class="post-analytics-thumb-placeholder">📁</div>`;

        const categories = Array.isArray(stat.post.categories) 
            ? stat.post.categories 
            : (stat.post.category ? [stat.post.category] : []);
        const catBadges = categories.slice(0, 2).map(c => 
            `<span style="font-size:0.7rem;padding:0.15rem 0.5rem;border-radius:99px;background:rgba(79,158,255,0.15);color:#4f9eff;border:1px solid rgba(79,158,255,0.3);margin-right:0.3rem;">${escapeHtml(c)}</span>`
        ).join('');

        return `
            <div class="post-analytics-item">
                ${thumb}
                <div class="post-analytics-info">
                    <h3 class="post-analytics-title">${escapeHtml(stat.post.title)}</h3>
                    <div class="post-analytics-meta">
                        ${catBadges}
                    </div>
                </div>
                <div class="post-analytics-stats">
                    <div class="post-analytics-stat">
                        <div class="post-analytics-stat-value">${stat.periodViews.toLocaleString()}</div>
                        <div class="post-analytics-stat-label">${getPeriodLabel()}</div>
                    </div>
                    <div class="post-analytics-stat">
                        <div class="post-analytics-stat-value" style="color: var(--text-secondary);">${stat.totalViews.toLocaleString()}</div>
                        <div class="post-analytics-stat-label">All Time</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ── FILTER HELPERS ────────────────────────────────────────────────────────────
function filterByPeriod(period) {
    currentPeriod = period;
    
    // Update active tab
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.period === period);
    });
    
    // Show/hide date range picker
    const dateRangePicker = document.getElementById('dateRangePicker');
    if (dateRangePicker) {
        dateRangePicker.style.display = period === 'custom' ? 'block' : 'none';
    }
    
    // If not custom, render immediately
    if (period !== 'custom') {
        customDateRange = { start: null, end: null };
        renderPostAnalytics();
    }
}

function applyCustomRange() {
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    
    if (!startDateInput.value || !endDateInput.value) {
        alert('Please select both start and end dates');
        return;
    }
    
    const startDate = new Date(startDateInput.value);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(endDateInput.value);
    endDate.setHours(23, 59, 59, 999);
    
    if (startDate > endDate) {
        alert('Start date must be before end date');
        return;
    }
    
    customDateRange = {
        start: startDate.getTime(),
        end: endDate.getTime()
    };
    
    renderPostAnalytics();
}

function filterViewsByPeriod(views, period) {
    const now = Date.now();
    
    switch (period) {
        case 'today':
            const todayStart = new Date().setHours(0, 0, 0, 0);
            return views.filter(v => v.timestamp >= todayStart);
        
        case 'week':
            const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
            return views.filter(v => v.timestamp >= weekAgo);
        
        case 'month':
            const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
            return views.filter(v => v.timestamp >= monthStart);
        
        case 'year':
            const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
            return views.filter(v => v.timestamp >= yearStart);
        
        case 'custom':
            if (customDateRange.start && customDateRange.end) {
                return views.filter(v => v.timestamp >= customDateRange.start && v.timestamp <= customDateRange.end);
            }
            return views;
        
        case 'all':
        default:
            return views;
    }
}

function getPeriodLabel() {
    switch (currentPeriod) {
        case 'today': return 'Today';
        case 'week': return 'This Week';
        case 'month': return 'This Month';
        case 'year': return 'This Year';
        case 'custom':
            if (customDateRange.start && customDateRange.end) {
                const start = new Date(customDateRange.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const end = new Date(customDateRange.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                return `${start} - ${end}`;
            }
            return 'Custom Range';
        case 'all':
        default: return 'All Time';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Portfolio Page JavaScript
import { database } from './firebase-config.js';
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import { ref as dbRef, push, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

let allPosts = {};
let allHighlights = {};
let postsLoaded = false;
let highlightsLoaded = false;

// ── TYPING EFFECT ─────────────────────────────────────────────────────────────
const typingText = document.getElementById('typingText');
const roles = [
  'Editor', 'Web Developer', 'Mobile Developer', 'Creator', 'Innovator',
  'Arduino Engineer', 'Technical Support', 'Systems Technician',
  'Network Engineer', 'Cyber Security', 'Software Engineer',
  'Prompt Engineer', 'Vibe Coder', 'AI Enthusiast', 'Tech Explorer',
];
let roleIndex = 0, charIndex = 0, isDeleting = false;

function typeEffect() {
    const currentRole = roles[roleIndex];
    typingText.textContent = isDeleting
        ? currentRole.substring(0, charIndex - 1)
        : currentRole.substring(0, charIndex + 1);
    isDeleting ? charIndex-- : charIndex++;
    if (!isDeleting && charIndex === currentRole.length) setTimeout(() => isDeleting = true, 2000);
    else if (isDeleting && charIndex === 0) { isDeleting = false; roleIndex = (roleIndex + 1) % roles.length; }
    setTimeout(typeEffect, isDeleting ? 50 : 100);
}
typeEffect();

// ── CATEGORIES CONFIG ─────────────────────────────────────────────────────────
const CATEGORIES = [
    'Web Development', 'Mobile Development', 'Arduino / IoT', 'Networking',
    'Cyber Security', 'IT Support', 'AI Automation', 'Game Development', 'Smart Systems',
];

const ICONS = {
    'Web Development': '🌐', 'Mobile Development': '📱', 'Arduino / IoT': '⚙️',
    'Networking': '🔗', 'Cyber Security': '🔒', 'IT Support': '🖥️',
    'AI Automation': '🤖', 'Game Development': '🎮', 'Smart Systems': '💡',
};

const CAT_COLORS = {
    'Web Development': '#4f9eff', 'Mobile Development': '#a78bfa', 'Arduino / IoT': '#34d399',
    'Networking': '#f59e0b', 'Cyber Security': '#f87171', 'IT Support': '#60a5fa',
    'AI Automation': '#e879f9', 'Game Development': '#fb923c', 'Smart Systems': '#2dd4bf',
};

function arrow() {
    return `<svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0"><polyline points="5 12 19 12"/><polyline points="13 6 19 12 13 18"/></svg>`;
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function getPostCategories(post) {
    if (Array.isArray(post.categories) && post.categories.length > 0) return post.categories;
    if (post.category) return [post.category];
    return [];
}

function postMatchesCategory(post, cat) {
    return getPostCategories(post).some(c => c.toLowerCase() === cat.toLowerCase());
}

function truncateText(text, maxLength) {
    if (!text) return '';
    return text.length <= maxLength ? text : text.substring(0, maxLength) + '...';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ── RENDER HIGHLIGHTS ─────────────────────────────────────────────────────────
// Only called once BOTH posts and highlights have loaded at least once
function maybeRender() {
    if (!postsLoaded || !highlightsLoaded) return;
    renderHighlights();
}

function renderHighlights() {
    const grid = document.getElementById('highlightsGrid');
    if (!grid) return;

    const postsArray = Object.values(allPosts);
    grid.innerHTML = '';

    CATEGORIES.forEach(cat => {
        const catCount = postsArray.filter(p => postMatchesCategory(p, cat)).length;

        // Look up the highlighted post ID for this category
        let post = null;
        const highlightedId = allHighlights[cat];
        if (highlightedId && allPosts[highlightedId]) {
            post = allPosts[highlightedId];
        }

        grid.appendChild(buildHighlightCard(cat, post, catCount));
    });
}

function buildHighlightCard(cat, post, catCount) {
    const card = document.createElement('div');
    card.className = 'highlight-card';
    card.dataset.cat = cat;
    card.style.setProperty('--accent-color', CAT_COLORS[cat] || '#94a3b8');

    const imageUrl = post ? (post.bannerImage?.data || (post.images && post.images[0]?.data) || null) : null;
    const thumb = imageUrl
        ? `<img class="highlight-thumb" src="${imageUrl}" alt="${escapeHtml(post.title)}" loading="lazy">`
        : `<div class="highlight-thumb-placeholder">${ICONS[cat] || '📁'}</div>`;

    const accentColor = CAT_COLORS[cat] || '#94a3b8';
    const countBadge = `<span style="font-size:0.68rem;font-weight:600;padding:0.2rem 0.55rem;border-radius:99px;background:${accentColor}22;color:${accentColor};border:1px solid ${accentColor}44;white-space:nowrap;">${catCount} project${catCount !== 1 ? 's' : ''}</span>`;

    // What to show when no highlight is set for this category
    const noHighlightMsg = catCount > 0
        ? 'No highlight project set for this category yet.'
        : 'No project added yet for this category.';

    card.innerHTML = `
        ${thumb}
        <div class="highlight-body">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;">
                <span class="highlight-category-label">${cat}</span>
                ${countBadge}
            </div>
            <p class="highlight-title">${post ? escapeHtml(post.title) : 'Coming Soon'}</p>
            <p class="highlight-desc">${post ? escapeHtml(truncateText(post.description, 100)) : noHighlightMsg}</p>
            <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;margin-top:1rem;">
                ${post ? `<button class="highlight-view-btn" data-postid="${post.id}" style="background:none;border:none;padding:0;cursor:pointer;font-family:inherit;">View Project ${arrow()}</button>` : ''}
                <a href="all-posts.html?cat=${encodeURIComponent(cat)}" class="highlight-view-btn" style="opacity:${post ? '0.6' : '1'};">Browse All ${arrow()}</a>
            </div>
        </div>`;

    // Attach click for View Project button
    const viewBtn = card.querySelector('[data-postid]');
    if (viewBtn) {
        viewBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openPostModal(viewBtn.dataset.postid);
        });
    }

    return card;
}

// ── LOAD DATA ─────────────────────────────────────────────────────────────────
function loadPortfolio() {
    // Load highlights — keyed by catToKey but each record stores the real category name
    onValue(ref(database, 'highlights'), (snap) => {
        allHighlights = {};
        if (snap.exists()) {
            snap.forEach(child => {
                const data = child.val();
                // data.category is the original string e.g. "Web Development"
                if (data && data.category && data.postId) {
                    allHighlights[data.category] = data.postId;
                }
            });
        }
        highlightsLoaded = true;
        maybeRender();
    });

    // Load posts
    onValue(ref(database, 'posts'), (snapshot) => {
        allPosts = {};
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                const postData = { id: childSnapshot.key, ...childSnapshot.val() };
                allPosts[childSnapshot.key] = postData;
            });
        }
        window.portfolioPosts = Object.values(allPosts).sort((a, b) => b.createdAt - a.createdAt);
        postsLoaded = true;
        maybeRender();
    }, (error) => {
        console.error('Error loading portfolio:', error);
        const grid = document.getElementById('highlightsGrid');
        if (grid) grid.innerHTML = `<div class="empty-state"><h3>Unable to load portfolio</h3><p>${error.message}</p></div>`;
    });
}

// ── POST MODAL ────────────────────────────────────────────────────────────────
function openPostModal(postId) {
    const post = allPosts[postId];
    if (!post) return;

    // Track view
    trackPostView(postId);

    let modal = document.getElementById('postViewModal');
    if (!modal) { modal = createPostModal(); document.body.appendChild(modal); }

    document.getElementById('modalPostTitle').textContent = post.title;

    // Multi-category badges
    const cats = getPostCategories(post);
    const catEl = document.getElementById('modalPostCategory');
    catEl.innerHTML = cats.map(c =>
        `<span style="display:inline-block;padding:0.2rem 0.6rem;border-radius:99px;font-size:0.75rem;font-weight:600;background:${CAT_COLORS[c] || '#94a3b8'}22;color:${CAT_COLORS[c] || '#94a3b8'};border:1px solid ${CAT_COLORS[c] || '#94a3b8'}44;margin:0.15rem;">${escapeHtml(c)}</span>`
    ).join('');

    // Description — preserve line breaks
    const descEl = document.getElementById('modalPostDescription');
    descEl.innerHTML = escapeHtml(post.description).replace(/\n/g, '<br>');

    const date = new Date(post.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('modalPostDate').textContent = `📅 ${date}`;

    // Banner
    const modalBanner = document.getElementById('modalPostBanner');
    if (post.bannerImage) {
        modalBanner.innerHTML = `<img src="${post.bannerImage.data}" alt="${escapeHtml(post.title)}">`;
        modalBanner.style.display = 'block';
    } else {
        modalBanner.style.display = 'none';
    }

    // Gallery
    const modalGallery = document.getElementById('modalPostGallery');
    if (post.images && post.images.length > 0) {
        let galleryHtml = '<h3>Gallery</h3><div class="modal-gallery-grid">';
        post.images.forEach((img, i) => {
            galleryHtml += `<div class="modal-gallery-item" onclick="viewImageFullSize('${img.data}')"><img src="${img.data}" alt="${escapeHtml(post.title)} - ${i + 1}"></div>`;
        });
        galleryHtml += '</div>';
        modalGallery.innerHTML = galleryHtml;
        modalGallery.style.display = 'block';
    } else {
        modalGallery.style.display = 'none';
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function createPostModal() {
    const modal = document.createElement('div');
    modal.id = 'postViewModal';
    modal.className = 'post-view-modal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="closePostModal()"></div>
        <div class="modal-container">
            <button class="modal-close" onclick="closePostModal()">&times;</button>
            <div class="modal-content">
                <div class="modal-header">
                    <h2 id="modalPostTitle"></h2>
                    <div id="modalPostCategory" style="display:flex;flex-wrap:wrap;gap:0.35rem;margin-top:0.4rem;"></div>
                </div>
                <div id="modalPostBanner" class="modal-banner"></div>
                <div class="modal-body">
                    <p id="modalPostDescription" style="white-space:pre-line;line-height:1.75;word-break:break-word;"></p>
                    <div class="modal-meta"><span id="modalPostDate"></span></div>
                    <div id="modalPostGallery" class="modal-gallery"></div>
                </div>
            </div>
        </div>`;
    return modal;
}

window.closePostModal = function () {
    const modal = document.getElementById('postViewModal');
    if (modal) { modal.classList.remove('active'); document.body.style.overflow = 'auto'; }
};

window.viewImageFullSize = function (imageSrc) {
    const viewer = document.createElement('div');
    viewer.style.cssText = `display:flex;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:10000;align-items:center;justify-content:center;padding:2rem;`;
    viewer.innerHTML = `
        <button onclick="this.parentElement.remove();document.body.style.overflow='auto';"
            style="position:absolute;top:20px;right:20px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.3);color:white;font-size:2rem;width:50px;height:50px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;">&times;</button>
        <img src="${imageSrc}" style="max-width:90%;max-height:90%;object-fit:contain;border-radius:8px;">`;
    viewer.onclick = (e) => { if (e.target === viewer) { viewer.remove(); document.body.style.overflow = 'auto'; } };
    document.body.appendChild(viewer);
};

// ── SMOOTH SCROLL ─────────────────────────────────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('postViewModal');
        if (modal && modal.classList.contains('active')) {
            window.closePostModal();
        }
        const imageViewer = document.getElementById('imageViewer');
        if (imageViewer) { imageViewer.remove(); document.body.style.overflow = 'auto'; }
    }
});

// ── VIEW TRACKING ─────────────────────────────────────────────────────────────
function trackPostView(postId) {
    try {
        console.log('📊 Tracking view for post:', postId);
        const viewData = {
            postId: postId,
            timestamp: Date.now(), // Use Date.now() instead of serverTimestamp() for testing
            page: 'portfolio'
        };
        const viewRef = dbRef(database, `views/${postId}`);
        console.log('📊 Pushing to Firebase:', viewData);
        push(viewRef, viewData)
            .then(() => {
                console.log('✅ View tracked successfully!');
            })
            .catch((error) => {
                console.error('❌ Error pushing view:', error);
            });
    } catch (error) {
        console.error('❌ Error tracking view:', error);
    }
}

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadPortfolio();
    import('./theme-manager.js').then(() => {
        // Theme manager will initialize itself
    }).catch(console.error);
});

// All Posts Page JavaScript
import { database } from './firebase-config.js';
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import { ref as dbRef, push, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

let allPosts = {};
let filteredPosts = {};
let currentModalPost = null;

// Make functions globally available
window.closeModal = closeModal;
window.openPostDetail = openPostDetail;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadAllPosts();
    setupSearchAndFilters();
    applyURLCategoryFilter();
});

// ── READ ?cat= FROM URL AND PRE-SELECT CATEGORY FILTER ───────────────────────
function applyURLCategoryFilter() {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get('cat');
    if (!cat) return;

    const categoryFilter = document.getElementById('categoryFilter');
    if (!categoryFilter) return;

    const options = Array.from(categoryFilter.options);
    const match = options.find(opt => opt.value.toLowerCase() === cat.toLowerCase());
    if (match) {
        categoryFilter.value = match.value;
    }
}

// ── LOAD ALL POSTS ────────────────────────────────────────────────────────────
function loadAllPosts() {
    const postsRef = ref(database, 'posts');
    const grid = document.getElementById('allPostsGrid');

    onValue(postsRef, (snapshot) => {
        grid.innerHTML = '';
        allPosts = {};
        filteredPosts = {};

        if (!snapshot.exists()) {
            grid.innerHTML = `
                <div class="empty-state">
                    <h3>No projects yet</h3>
                    <p>Check back soon for new content!</p>
                </div>
            `;
            updateResultsCount(0);
            return;
        }

        snapshot.forEach((childSnapshot) => {
            const postData = { id: childSnapshot.key, ...childSnapshot.val() };
            allPosts[childSnapshot.key] = postData;
            filteredPosts[childSnapshot.key] = postData;
        });

        applyFiltersAndDisplay();
    }, (error) => {
        console.error('Error loading posts:', error);
        grid.innerHTML = `
            <div class="empty-state">
                <h3>Unable to load projects</h3>
                <p>Please try again later.</p>
            </div>
        `;
        updateResultsCount(0);
    });
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
// Returns array of categories regardless of old/new data format
function getPostCategories(post) {
    if (Array.isArray(post.categories) && post.categories.length > 0) return post.categories;
    if (post.category) return [post.category];
    return [];
}

// ── APPLY FILTERS ─────────────────────────────────────────────────────────────
function applyFiltersAndDisplay() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const categoryFilter = document.getElementById('categoryFilter').value;
    const sortFilter = document.getElementById('sortFilter').value;
    const grid = document.getElementById('allPostsGrid');

    filteredPosts = {};
    Object.keys(allPosts).forEach(key => {
        const post = allPosts[key];
        const cats = getPostCategories(post);

        const matchesSearch = !searchTerm ||
            post.title.toLowerCase().includes(searchTerm) ||
            post.description.toLowerCase().includes(searchTerm);

        const matchesCategory = !categoryFilter ||
            cats.some(c => c.toLowerCase() === categoryFilter.toLowerCase());

        if (matchesSearch && matchesCategory) filteredPosts[key] = post;
    });

    let postsArray = Object.values(filteredPosts);

    switch (sortFilter) {
        case 'newest':   postsArray.sort((a, b) => b.createdAt - a.createdAt); break;
        case 'oldest':   postsArray.sort((a, b) => a.createdAt - b.createdAt); break;
        case 'title-asc':  postsArray.sort((a, b) => a.title.localeCompare(b.title)); break;
        case 'title-desc': postsArray.sort((a, b) => b.title.localeCompare(a.title)); break;
    }

    updateResultsCount(postsArray.length);
    grid.innerHTML = '';

    if (postsArray.length === 0) {
        grid.innerHTML = '<div class="empty-state"><p>No projects match your search criteria.</p></div>';
        return;
    }

    postsArray.forEach(post => grid.appendChild(createPostCard(post)));
}

// ── CREATE POST CARD ──────────────────────────────────────────────────────────
function createPostCard(post) {
    const card = document.createElement('div');
    card.className = 'post-card';
    card.onclick = () => openPostDetail(post.id);

    const date = new Date(post.createdAt).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    const imageUrl = post.bannerImage?.data || (post.images && post.images[0]?.data) || post.imageData;
    const cats = getPostCategories(post);
    const catBadges = cats.map(c => `<span class="post-category">${escapeHtml(c)}</span>`).join('');

    card.innerHTML = `
        ${imageUrl
            ? `<div class="post-banner"><img src="${imageUrl}" alt="${escapeHtml(post.title)}"></div>`
            : '<div class="post-banner"><div class="no-image">No Image</div></div>'}
        <div class="post-content">
            <div class="post-categories">${catBadges}</div>
            <h3 class="post-title">${escapeHtml(post.title)}</h3>
            <p class="post-description">${escapeHtml(truncateText(post.description, 120))}</p>
            <div class="post-meta">
                📅 ${date}
                ${post.imageCount ? ` • 🖼️ ${post.imageCount} images` : ''}
            </div>
        </div>
    `;

    return card;
}

// ── OPEN POST DETAIL MODAL ────────────────────────────────────────────────────
function openPostDetail(postId) {
    const post = allPosts[postId];
    if (!post) return;

    // Track view
    trackPostView(postId);

    currentModalPost = post;

    document.getElementById('modalTitle').textContent = post.title;

    // Multi-category support
    const cats = getPostCategories(post);
    const modalCatEl = document.getElementById('modalCategory');
    modalCatEl.innerHTML = cats.map(c => `<span class="post-category">${escapeHtml(c)}</span>`).join('');

    // Description — preserve line breaks
    const modalDesc = document.getElementById('modalDescription');
    modalDesc.innerHTML = escapeHtml(post.description).replace(/\n/g, '<br>');

    const date = new Date(post.createdAt).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
    document.getElementById('modalDate').textContent = `📅 ${date}`;

    // Banner
    const modalBanner = document.getElementById('modalBanner');
    if (post.bannerImage) {
        modalBanner.innerHTML = `<img src="${post.bannerImage.data}" alt="${escapeHtml(post.title)}">`;
        modalBanner.style.display = 'block';
    } else {
        modalBanner.style.display = 'none';
    }

    // Gallery
    const modalGallery = document.getElementById('modalGallery');
    if (post.images && post.images.length > 0) {
        let galleryHtml = '<h3>Gallery</h3><div class="gallery-grid">';
        post.images.forEach((img, index) => {
            galleryHtml += `
                <div class="gallery-item" onclick="viewImageFullSize('${img.data}')">
                    <img src="${img.data}" alt="${escapeHtml(post.title)} - ${index + 1}">
                </div>`;
        });
        galleryHtml += '</div>';
        modalGallery.innerHTML = galleryHtml;
        modalGallery.style.display = 'block';
    } else {
        modalGallery.style.display = 'none';
    }

    document.getElementById('postModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

// ── CLOSE MODAL ───────────────────────────────────────────────────────────────
function closeModal() {
    document.getElementById('postModal').classList.remove('active');
    document.body.style.overflow = 'auto';
    currentModalPost = null;
}

// ── SEARCH & FILTERS ──────────────────────────────────────────────────────────
function setupSearchAndFilters() {
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const sortFilter = document.getElementById('sortFilter');
    const clearFilters = document.getElementById('clearFilters');

    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => applyFiltersAndDisplay(), 300);
    });

    categoryFilter.addEventListener('change', applyFiltersAndDisplay);
    sortFilter.addEventListener('change', applyFiltersAndDisplay);

    clearFilters.addEventListener('click', () => {
        searchInput.value = '';
        categoryFilter.value = '';
        sortFilter.value = 'newest';
        history.replaceState(null, '', window.location.pathname);
        applyFiltersAndDisplay();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.getElementById('postModal').classList.contains('active')) {
            closeModal();
        }
    });
}

// ── UTILS ─────────────────────────────────────────────────────────────────────
function updateResultsCount(count) {
    document.getElementById('resultsCount').textContent = `${count} project${count !== 1 ? 's' : ''} found`;
}

function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ── VIEW TRACKING ─────────────────────────────────────────────────────────────
function trackPostView(postId) {
    try {
        console.log('📊 Tracking view for post:', postId);
        const viewData = {
            postId: postId,
            timestamp: Date.now(), // Use Date.now() instead of serverTimestamp() for testing
            page: 'all-posts'
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

// ── FULL SIZE IMAGE VIEWER ────────────────────────────────────────────────────
window.viewImageFullSize = function (imageSrc) {
    const viewer = document.createElement('div');
    viewer.style.cssText = `display:flex;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:10000;align-items:center;justify-content:center;padding:2rem;`;
    viewer.innerHTML = `
        <button onclick="this.parentElement.remove();document.body.style.overflow='auto';"
            style="position:absolute;top:20px;right:20px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.3);color:white;font-size:2rem;width:50px;height:50px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;">&times;</button>
        <img src="${imageSrc}" style="max-width:90%;max-height:90%;object-fit:contain;border-radius:8px;">
    `;
    viewer.onclick = (e) => {
        if (e.target === viewer) { viewer.remove(); document.body.style.overflow = 'auto'; }
    };
    document.body.appendChild(viewer);
};
// Admin Posts JavaScript
import { auth, database } from './firebase-config.js';
import { signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { ref, onValue, remove, push, update, set } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import { loadSidebar } from './sidebar-loader.js';

let currentUser = null;
let currentModalPostId = null;
let selectedFiles = [];
let bannerImage = null;
let allPosts = {};
let filteredPosts = {};
let editMode = false;
let editingPostId = null;
let editExistingImages = [];
let editExistingBanner = null;
let _formSaved = false; // true after a successful save — suppresses "unsaved changes" prompt

// Banner crop state
// cx/cy = pixel coords of the image point shown at center of viewport
// zoom  = scale multiplier (1 = fit-to-cover baseline)
let bannerCrop = { cx: 0, cy: 0, zoom: 1 };
let bannerCropOriginalSrc = null;   // raw base64 of original image
let bannerNaturalW = 0;             // natural image dimensions
let bannerNaturalH = 0;
let bannerBaseZoom = 1;             // minimum zoom to cover 16:9 viewport

// Make functions globally available
window.logout = logout;
window.viewPost = viewPost;
window.editPost = editPost;
window.deletePost = deletePost;
window.closePostModal = closePostModal;
window.editPostFromModal = editPostFromModal;
window.deletePostFromModal = deletePostFromModal;
window.openAddPostModal = openAddPostModal;
window.closeAddPostModal = closeAddPostModal;
window.removeImage = removeImage;
window.removeExistingImage = removeExistingImage;
window.removeBanner = removeBanner;
window.viewImageFullSize = viewImageFullSize;
window.closeImageViewer = closeImageViewer;
window.openHighlightPicker = openHighlightPicker;
window.closeHighlightPicker = closeHighlightPicker;
window.setHighlight = setHighlight;
window.removeHighlight = removeHighlight;

const ALL_CATEGORIES = [
    'Web Development', 'Mobile Development', 'Arduino / IoT', 'Networking',
    'Cyber Security', 'IT Support', 'AI Automation', 'Game Development', 'Smart Systems',
];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupAuthStateListener();
    setupModalClickOutside();
    setupPostForm();
    setupFileInput();
    setupBannerInput();
    setupSearchAndFilters();
    createImageViewerModal();
    createHighlightPickerModal();
    renderCategoryCheckboxes();
});

// ── CATEGORY CHECKBOXES ───────────────────────────────────────────────────────
function renderCategoryCheckboxes(selectedCategories = []) {
    const container = document.getElementById('categoryCheckboxes');
    if (!container) return;
    container.innerHTML = ALL_CATEGORIES.map(cat => `
        <label class="cat-checkbox-label">
            <input type="checkbox" name="postCategory" value="${cat}"
                ${selectedCategories.includes(cat) ? 'checked' : ''}>
            <span>${cat}</span>
        </label>
    `).join('');
}

function getSelectedCategories() {
    return Array.from(document.querySelectorAll('input[name="postCategory"]:checked')).map(cb => cb.value);
}

// ── HIGHLIGHT PICKER MODAL ────────────────────────────────────────────────────
let highlightPickerCategory = null;
let currentHighlights = {};

function createHighlightPickerModal() {
    const modal = document.createElement('div');
    modal.id = 'highlightPickerModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content modal-large">
            <div class="modal-header">
                <h2 id="highlightPickerTitle">Select Highlight</h2>
                <button class="modal-close" onclick="closeHighlightPicker()">×</button>
            </div>
            <div class="modal-body">
                <p style="color:var(--text-secondary);margin-bottom:1rem;">Choose which project to feature for this category.</p>
                <div id="highlightPickerList" style="display:flex;flex-direction:column;gap:0.75rem;max-height:60vh;overflow-y:auto;"></div>
            </div>
        </div>`;
    document.body.appendChild(modal);
}

function openHighlightPicker(category) {
    highlightPickerCategory = category;
    document.getElementById('highlightPickerTitle').textContent = `Choose Highlight — ${category}`;
    const list = document.getElementById('highlightPickerList');
    list.innerHTML = '';

    const matching = Object.values(allPosts).filter(p => {
        const cats = Array.isArray(p.categories) ? p.categories : [p.category];
        return cats.some(c => c.toLowerCase() === category.toLowerCase());
    });

    if (matching.length === 0) {
        list.innerHTML = '<p style="color:var(--text-secondary)">No posts found for this category.</p>';
    } else {
        matching.forEach(post => {
            const isSelected = currentHighlights[category] === post.id;
            const imageUrl = post.bannerImage?.data || (post.images && post.images[0]?.data);
            const item = document.createElement('div');
            item.style.cssText = `display:flex;align-items:center;gap:1rem;padding:0.75rem;border-radius:8px;border:2px solid ${isSelected ? 'var(--accent-primary,#4f9eff)' : 'var(--border-color)'};cursor:pointer;transition:border 0.2s;`;
            item.innerHTML = `
                ${imageUrl ? `<img src="${imageUrl}" style="width:80px;height:50px;object-fit:cover;border-radius:6px;flex-shrink:0;">` : `<div style="width:80px;height:50px;background:rgba(255,255,255,0.05);border-radius:6px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1.5rem;">📁</div>`}
                <div style="flex:1;min-width:0;">
                    <p style="font-weight:600;color:var(--text-primary);margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(post.title)}</p>
                    <p style="font-size:0.8rem;color:var(--text-secondary);margin:0;">${escapeHtml(post.description?.substring(0, 80) || '')}...</p>
                </div>
                ${isSelected ? '<span style="color:#4f9eff;font-weight:700;flex-shrink:0;">✓ Selected</span>' : ''}`;
            item.onclick = () => setHighlight(category, post.id);
            list.appendChild(item);
        });
    }

    document.getElementById('highlightPickerModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeHighlightPicker() {
    document.getElementById('highlightPickerModal').classList.remove('active');
    document.body.style.overflow = 'auto';
    highlightPickerCategory = null;
}

function catToKey(category) {
    return category.replace(/[.#$[\]/\s]/g, '_');
}

async function setHighlight(category, postId) {
    try {
        await set(ref(database, `highlights/${catToKey(category)}`), { category, postId });
        currentHighlights[category] = postId;
        closeHighlightPicker();
        renderHighlightManager();
        showToast('✓ Highlight updated!', 'success');
    } catch (err) {
        console.error(err);
        showToast('✗ Failed to update highlight', 'error');
    }
}

async function removeHighlight(category) {
    const ok = await showConfirm({
        title: 'Remove Highlight',
        message: `Remove the featured project for <strong style="color:var(--text-primary)">${escapeHtml(category)}</strong>?`,
        details: 'The project will still exist — it just won\'t be featured on the homepage.',
        confirmText: 'Remove',
        cancelText: 'Cancel',
        confirmClass: 'btn-danger',
    });
    if (!ok) return;
    try {
        await set(ref(database, `highlights/${catToKey(category)}`), null);
        delete currentHighlights[category];
        renderHighlightManager();
        showToast('✓ Highlight removed!', 'success');
    } catch (err) { console.error(err); showToast('✗ Failed to remove highlight', 'error'); }
}

function loadHighlights() {
    onValue(ref(database, 'highlights'), (snapshot) => {
        currentHighlights = {};
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                const data = child.val();
                if (data) currentHighlights[data.category] = data.postId;
            });
        }
        renderHighlightManager();
    });
}

function renderHighlightManager() {
    const container = document.getElementById('highlightManager');
    if (!container) return;

    // Update highlights tab badge
    const highlightCountBadge = document.getElementById('highlightCount');
    if (highlightCountBadge) {
        highlightCountBadge.textContent = Object.keys(currentHighlights).length;
    }

    container.innerHTML = ALL_CATEGORIES.map(cat => {
        const postId = currentHighlights[cat];
        const post = postId ? allPosts[postId] : null;
        const imageUrl = post?.bannerImage?.data || (post?.images && post.images[0]?.data);
        const catPostCount = Object.values(allPosts).filter(p => {
            const cats = Array.isArray(p.categories) ? p.categories : [p.category];
            return cats.some(c => c.toLowerCase() === cat.toLowerCase());
        }).length;

        return `
        <div style="display:flex;align-items:center;gap:1rem;padding:0.9rem 1rem;border-radius:10px;border:1px solid var(--border-color);background:var(--bg-secondary);">
            <div style="width:10px;height:10px;border-radius:50%;background:${getCatColor(cat)};flex-shrink:0;"></div>
            <div style="flex:1;min-width:0;">
                <p style="font-weight:600;color:var(--text-primary);margin:0;">${cat}</p>
                <p style="font-size:0.75rem;color:var(--text-secondary);margin:0;">${catPostCount} project${catPostCount !== 1 ? 's' : ''}</p>
            </div>
            ${post ? `
                <div style="display:flex;align-items:center;gap:0.6rem;flex:2;min-width:0;">
                    ${imageUrl ? `<img src="${imageUrl}" style="width:50px;height:32px;object-fit:cover;border-radius:4px;flex-shrink:0;">` : ''}
                    <p style="font-size:0.82rem;color:var(--text-primary);margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(post.title)}</p>
                </div>
                <div style="display:flex;gap:0.5rem;flex-shrink:0;">
                    <button class="btn btn-secondary btn-sm" onclick="openHighlightPicker('${cat}')">Change</button>
                    <button class="btn btn-danger btn-sm" onclick="removeHighlight('${cat}')">Remove</button>
                </div>
            ` : `
                <p style="font-size:0.82rem;color:var(--text-secondary);margin:0;flex:2;">No highlight set</p>
                <button class="btn btn-primary btn-sm" onclick="openHighlightPicker('${cat}')" style="flex-shrink:0;">${catPostCount > 0 ? 'Set Highlight' : 'No Posts Yet'}</button>
            `}
        </div>`;
    }).join('');
}

function getCatColor(cat) {
    const colors = {
        'Web Development': '#4f9eff', 'Mobile Development': '#a78bfa', 'Arduino / IoT': '#34d399',
        'Networking': '#f59e0b', 'Cyber Security': '#f87171', 'IT Support': '#60a5fa',
        'AI Automation': '#e879f9', 'Game Development': '#fb923c', 'Smart Systems': '#2dd4bf',
    };
    return colors[cat] || '#94a3b8';
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.style.cssText = `position:fixed;top:20px;right:20px;z-index:99999;padding:0.75rem 1.5rem;border-radius:8px;font-weight:600;background:${type === 'success' ? '#22c55e' : '#ef4444'};color:white;box-shadow:0 4px 12px rgba(0,0,0,0.3);`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ── CONFIRMATION MODAL ────────────────────────────────────────────────────────
function showConfirm({ title = 'Are you sure?', message = '', confirmText = 'Confirm', cancelText = 'Cancel', confirmClass = 'btn-danger', details = '' } = {}) {
    return new Promise((resolve) => {
        document.getElementById('confirmModal')?.remove();

        const modal = document.createElement('div');
        modal.id = 'confirmModal';
        modal.style.cssText = `
            position:fixed;inset:0;z-index:99998;
            display:flex;align-items:center;justify-content:center;
            background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);
            padding:1rem;animation:fadeIn 0.15s ease;
        `;
        modal.innerHTML = `
            <style>
                @keyframes fadeIn { from { opacity:0; transform:scale(0.96); } to { opacity:1; transform:scale(1); } }
                #confirmModalBox { animation: fadeIn 0.15s ease; }
            </style>
            <div id="confirmModalBox" style="
                background:var(--bg-primary,#0f0f1a);
                border:1px solid var(--border-color,rgba(255,255,255,0.12));
                border-radius:14px;
                padding:1.75rem;
                max-width:420px;
                width:100%;
                box-shadow:0 24px 60px rgba(0,0,0,0.5);
            ">
                <div style="display:flex;align-items:flex-start;gap:1rem;margin-bottom:1.25rem;">
                    <div id="confirmIcon" style="font-size:1.6rem;flex-shrink:0;line-height:1;margin-top:2px;"></div>
                    <div style="flex:1;min-width:0;">
                        <h3 style="margin:0 0 0.35rem;font-size:1.05rem;color:var(--text-primary,#f0f0f0);font-weight:700;">${title}</h3>
                        <p style="margin:0;font-size:0.875rem;color:var(--text-secondary,#94a3b8);line-height:1.55;">${message}</p>
                        ${details ? `<p style="margin:0.6rem 0 0;font-size:0.78rem;color:var(--text-secondary,#94a3b8);opacity:0.7;font-style:italic;">${details}</p>` : ''}
                    </div>
                </div>
                <div style="display:flex;gap:0.6rem;justify-content:flex-end;">
                    <button id="confirmCancelBtn" style="
                        padding:0.5rem 1.1rem;border-radius:8px;font-size:0.875rem;font-weight:600;
                        background:rgba(255,255,255,0.05);border:1px solid var(--border-color,rgba(255,255,255,0.12));
                        color:var(--text-secondary,#94a3b8);cursor:pointer;transition:all 0.15s;
                    ">${cancelText}</button>
                    <button id="confirmOkBtn" style="
                        padding:0.5rem 1.25rem;border-radius:8px;font-size:0.875rem;font-weight:600;
                        border:none;cursor:pointer;transition:all 0.15s;
                    ">${confirmText}</button>
                </div>
            </div>
        `;

        const iconEl = modal.querySelector('#confirmIcon');
        const okBtn = modal.querySelector('#confirmOkBtn');
        if (confirmClass === 'btn-danger') {
            iconEl.textContent = '🗑️';
            okBtn.style.cssText += 'background:#ef4444;color:white;';
        } else if (confirmClass === 'btn-warning') {
            iconEl.textContent = '⚠️';
            okBtn.style.cssText += 'background:#f59e0b;color:white;';
        } else if (confirmClass === 'btn-secondary') {
            iconEl.textContent = '💬';
            okBtn.style.cssText += 'background:rgba(255,255,255,0.1);color:var(--text-primary,#f0f0f0);border:1px solid rgba(255,255,255,0.15);';
        } else {
            iconEl.textContent = '✅';
            okBtn.style.cssText += 'background:#4f9eff;color:white;';
        }

        document.body.appendChild(modal);

        const cleanup = (result) => {
            modal.style.opacity = '0';
            modal.style.transition = 'opacity 0.1s';
            setTimeout(() => modal.remove(), 100);
            resolve(result);
        };

        modal.querySelector('#confirmOkBtn').addEventListener('click', () => cleanup(true));
        modal.querySelector('#confirmCancelBtn').addEventListener('click', () => cleanup(false));
        modal.addEventListener('click', (e) => { if (e.target === modal) cleanup(false); });
        document.addEventListener('keydown', function handler(e) {
            if (e.key === 'Enter') { cleanup(true); document.removeEventListener('keydown', handler); }
            if (e.key === 'Escape') { cleanup(false); document.removeEventListener('keydown', handler); }
        });

        setTimeout(() => modal.querySelector('#confirmCancelBtn')?.focus(), 50);
    });
}

// ── IMAGE VIEWER ──────────────────────────────────────────────────────────────
function createImageViewerModal() {
    const viewer = document.createElement('div');
    viewer.id = 'imageViewer';
    viewer.style.cssText = `display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:10000;align-items:center;justify-content:center;padding:2rem;`;
    viewer.innerHTML = `
        <button onclick="closeImageViewer()" style="position:absolute;top:20px;right:20px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.3);color:white;font-size:2rem;width:50px;height:50px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;">&times;</button>
        <img id="viewerImage" style="max-width:90%;max-height:90%;object-fit:contain;border-radius:8px;">`;
    document.body.appendChild(viewer);
}

function viewImageFullSize(imageSrc) {
    const viewer = document.getElementById('imageViewer');
    document.getElementById('viewerImage').src = imageSrc;
    viewer.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeImageViewer() {
    document.getElementById('imageViewer').style.display = 'none';
    document.body.style.overflow = 'auto';
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
function setupAuthStateListener() {
    onAuthStateChanged(auth, async (user) => {
        currentUser = user;
        if (user) {
            await loadSidebar();
            document.getElementById('userEmail').textContent = user.email;
            loadAdminPosts();
            loadHighlights();
        } else {
            window.location.href = 'admin.html';
        }
    });
}

async function logout() {
    const ok = await showConfirm({
        title: 'Logout',
        message: 'Are you sure you want to log out of the admin panel?',
        confirmText: 'Logout',
        cancelText: 'Stay',
        confirmClass: 'btn-warning',
    });
    if (ok) signOut(auth).then(() => window.location.href = 'admin.html').catch(console.error);
}

// ── LOAD POSTS ────────────────────────────────────────────────────────────────
function loadAdminPosts() {
    const postsRef = ref(database, 'posts');
    const list = document.getElementById('adminPostsList');
    const countBadge = document.getElementById('postCount');

    onValue(postsRef, (snapshot) => {
        list.innerHTML = '';
        allPosts = {};
        filteredPosts = {};

        if (!snapshot.exists()) {
            list.innerHTML = '<div class="empty-state"><p>No posts yet. Click "Add New Post" to create one!</p></div>';
            countBadge.textContent = '0';
            renderHighlightManager();
            return;
        }

        snapshot.forEach((childSnapshot) => {
            const postData = { id: childSnapshot.key, ...childSnapshot.val() };
            allPosts[childSnapshot.key] = postData;
            filteredPosts[childSnapshot.key] = postData;
        });

        applyFiltersAndDisplay();
        renderHighlightManager();
    });
}

// ── FILTERS ───────────────────────────────────────────────────────────────────
function applyFiltersAndDisplay() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const categoryFilter = document.getElementById('categoryFilter')?.value || '';
    const sortFilter = document.getElementById('sortFilter')?.value || 'newest';
    const list = document.getElementById('adminPostsList');
    const countBadge = document.getElementById('postCount');

    filteredPosts = {};
    Object.keys(allPosts).forEach(key => {
        const post = allPosts[key];
        const postCats = Array.isArray(post.categories) ? post.categories : [post.category].filter(Boolean);
        const matchesSearch = !searchTerm ||
            post.title.toLowerCase().includes(searchTerm) ||
            post.description.toLowerCase().includes(searchTerm);
        const matchesCategory = !categoryFilter ||
            postCats.some(c => c.toLowerCase() === categoryFilter.toLowerCase());
        if (matchesSearch && matchesCategory) filteredPosts[key] = post;
    });

    let postsArray = Object.values(filteredPosts);
    switch (sortFilter) {
        case 'newest': postsArray.sort((a, b) => b.createdAt - a.createdAt); break;
        case 'oldest': postsArray.sort((a, b) => a.createdAt - b.createdAt); break;
        case 'title-asc': postsArray.sort((a, b) => a.title.localeCompare(b.title)); break;
        case 'title-desc': postsArray.sort((a, b) => b.title.localeCompare(a.title)); break;
    }

    countBadge.textContent = postsArray.length;
    list.innerHTML = '';

    if (postsArray.length === 0) {
        list.innerHTML = '<div class="empty-state"><p>No posts match your search criteria.</p></div>';
        return;
    }

    postsArray.forEach(post => list.appendChild(createPostListItem(post)));
}

function createPostListItem(post) {
    const item = document.createElement('div');
    item.className = 'post-list-item';
    const date = new Date(post.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const imageCount = post.imageCount || 0;
    const bannerImageHtml = post.bannerImage
        ? `<div class="post-banner"><img src="${post.bannerImage.data}" alt="${escapeHtml(post.title)}"></div>` : '';
    const cats = Array.isArray(post.categories) ? post.categories : [post.category].filter(Boolean);
    const catBadges = cats.map(c => `<span class="post-list-category" style="margin-right:0.3rem;">${c}</span>`).join('');

    item.innerHTML = `
        ${bannerImageHtml}
        <div class="post-list-header">
            <div>
                <h3 class="post-list-title">${escapeHtml(post.title)}</h3>
                <div style="margin-top:0.3rem;">${catBadges}</div>
            </div>
        </div>
        <p class="post-list-description">${escapeHtml(post.description)}</p>
        <div class="post-list-meta">
            📅 Created: ${date}
            ${imageCount > 0 ? `<br>🖼️ Gallery Images: ${imageCount}` : ''}
        </div>
        <div class="post-list-actions">
            <button class="btn btn-primary btn-sm" onclick="viewPost('${post.id}')">👁️ View</button>
            <button class="btn btn-secondary btn-sm" onclick="editPost('${post.id}')">✏️ Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deletePost('${post.id}')">🗑️ Delete</button>
        </div>`;
    return item;
}

// ── VIEW POST ─────────────────────────────────────────────────────────────────
function viewPost(postId) {
    const post = allPosts[postId];
    if (!post) { alert('Post not found.'); return; }

    currentModalPostId = postId;
    document.getElementById('modalTitle').textContent = post.title;

    const cats = Array.isArray(post.categories) ? post.categories : [post.category].filter(Boolean);
    document.getElementById('modalCategory').textContent = cats.join(', ');
    document.getElementById('modalDescription').textContent = post.description;

    const date = new Date(post.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('modalDate').textContent = `Created: ${date}`;

    const modalImage = document.getElementById('modalImage');
    let imagesHtml = '';

    if (post.bannerImage) {
        imagesHtml += `
            <div style="margin-bottom:1.5rem;">
                <h3 style="margin-bottom:0.5rem;color:var(--text-primary);">Banner Image</h3>
                <div style="cursor:pointer;border-radius:12px;overflow:hidden;border:2px solid var(--accent-primary);aspect-ratio:16/9;max-width:800px;" onclick="viewImageFullSize('${post.bannerImage.data}')">
                    <img src="${post.bannerImage.data}" alt="${escapeHtml(post.title)}" style="width:100%;height:100%;object-fit:cover;display:block;">
                </div>
            </div>`;
    }

    if (post.images && post.images.length > 0) {
        imagesHtml += `<div><h3 style="margin-bottom:0.5rem;color:var(--text-primary);">Gallery Images</h3><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem;">`;
        post.images.forEach((img, i) => {
            imagesHtml += `<div style="cursor:pointer;border-radius:8px;overflow:hidden;border:1px solid var(--border-color);" onclick="viewImageFullSize('${img.data}')"><img src="${img.data}" alt="${escapeHtml(post.title)} - ${i + 1}" style="width:100%;height:200px;object-fit:cover;display:block;"></div>`;
        });
        imagesHtml += '</div></div>';
    }

    modalImage.innerHTML = imagesHtml || '<div class="no-image">📷 No images available</div>';
    modalImage.style.display = 'block';
    document.getElementById('postModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

// ── EDIT POST ─────────────────────────────────────────────────────────────────
function editPost(postId) {
    const post = allPosts[postId];
    if (!post) { alert('Post not found.'); return; }

    editMode = true;
    editingPostId = postId;
    editExistingImages = post.images ? [...post.images] : [];
    editExistingBanner = post.bannerImage ? { ...post.bannerImage } : null;
    selectedFiles = [];
    bannerImage = null;
    _formSaved = false;

    bannerCrop = post.bannerImage?.crop || { cx: 0, cy: 0, zoom: 1 };
    bannerCropOriginalSrc = post.bannerImage?.originalData || post.bannerImage?.data || null;
    bannerNaturalW = 0; bannerNaturalH = 0;
    _bannerImgCache = null; _bannerImgSrc = null;

    document.getElementById('postTitle').value = post.title;
    document.getElementById('postDescription').value = post.description;

    const cats = Array.isArray(post.categories) ? post.categories : [post.category].filter(Boolean);
    renderCategoryCheckboxes(cats);

    document.querySelector('#addPostModal .modal-header h2').textContent = 'Edit Post';
    document.getElementById('submitBtnText').textContent = 'Update Post';

    updateEditImagePreviews();

    if (bannerCropOriginalSrc) {
        initBannerCrop(bannerCropOriginalSrc, false);
    } else {
        document.getElementById('bannerPreview').innerHTML = '';
    }

    document.getElementById('addPostModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

// ── BANNER INPUT ──────────────────────────────────────────────────────────────
function setupBannerInput() {
    const bannerInput = document.getElementById('bannerInput');
    const maxSize = 1 * 1024 * 1024;

    bannerInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > maxSize) { alert('Max size is 1MB'); bannerInput.value = ''; return; }
        if (!file.type.startsWith('image/')) { alert('Not an image'); bannerInput.value = ''; return; }
        bannerImage = file;
        bannerInput.value = '';

        const reader = new FileReader();
        reader.onload = (ev) => {
            bannerCropOriginalSrc = ev.target.result;
            initBannerCrop(bannerCropOriginalSrc, true);
        };
        reader.readAsDataURL(file);
    });
}

function initBannerCrop(src, reset = true) {
    const img = new Image();
    img.onload = () => {
        bannerNaturalW = img.naturalWidth;
        bannerNaturalH = img.naturalHeight;

        if (reset) {
            bannerCrop = { cx: bannerNaturalW / 2, cy: bannerNaturalH / 2, zoom: 1.0 };
        }
        buildBannerEditor();
    };
    img.src = src;
}

// ── BANNER EDITOR (pure canvas) ───────────────────────────────────────────────
function buildBannerEditor() {
    const previewContainer = document.getElementById('bannerPreview');
    previewContainer.innerHTML = '';

    const src = bannerCropOriginalSrc;
    if (!src) return;

    const CANVAS_ASPECT = 16 / 9;

    const wrapper = document.createElement('div');
    wrapper.className = 'banner-crop-wrapper';
    wrapper.innerHTML = `
        <div class="banner-crop-header">
            <span class="banner-crop-title">🖼️ Banner Preview</span>
            <span class="banner-crop-hint">Drag image to reposition • Zoom to scale</span>
            <button type="button" class="banner-crop-remove" onclick="removeBanner()">✕ Remove</button>
        </div>
        <div class="banner-crop-viewport" id="bannerCropViewport" style="position:relative;width:100%;aspect-ratio:16/9;overflow:hidden;background:#000;cursor:grab;">
            <canvas id="bannerCropCanvas" style="position:absolute;top:0;left:0;width:100%;height:100%;display:block;"></canvas>
            <div class="banner-crop-overlay" style="position:absolute;inset:0;pointer-events:none;
                background-image:linear-gradient(rgba(255,255,255,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.05) 1px,transparent 1px);
                background-size:33.333% 33.333%;
                display:flex;align-items:flex-end;justify-content:center;padding-bottom:0.6rem;">
                <span style="font-size:0.7rem;color:rgba(255,255,255,0.45);background:rgba(0,0,0,0.45);padding:0.2rem 0.6rem;border-radius:99px;backdrop-filter:blur(4px);">↕ Drag to reposition</span>
            </div>
        </div>
        <div class="banner-crop-controls">
            <div class="banner-crop-control-row">
                <label class="banner-crop-label">
                    <span>🔍 Zoom</span>
                    <span id="bannerZoomValue">100%</span>
                </label>
                <input type="range" id="bannerZoomSlider" min="100" max="300" step="1" value="100" class="banner-crop-slider">
            </div>
            <button type="button" class="banner-crop-reset" id="bannerCropReset">↺ Reset to Center</button>
        </div>
    `;

    previewContainer.appendChild(wrapper);

    const viewport = document.getElementById('bannerCropViewport');
    const canvas = document.getElementById('bannerCropCanvas');

    const ro = new ResizeObserver(() => {
        canvas.width = viewport.clientWidth;
        canvas.height = viewport.clientHeight;
        drawBannerCanvas();
    });
    ro.observe(viewport);

    requestAnimationFrame(() => {
        canvas.width = viewport.clientWidth;
        canvas.height = Math.round(viewport.clientWidth / CANVAS_ASPECT);
        computeCoverZoom(canvas.width, canvas.height);
        drawBannerCanvas();
    });

    setupBannerCanvasInteractions(viewport, canvas);

    const zoomSlider = document.getElementById('bannerZoomSlider');
    zoomSlider.addEventListener('input', () => {
        const coverZoom = getCoverZoom(canvas.width, canvas.height);
        bannerCrop.zoom = coverZoom * (zoomSlider.value / 100);
        document.getElementById('bannerZoomValue').textContent = `${zoomSlider.value}%`;
        clampCrop(canvas.width, canvas.height);
        drawBannerCanvas();
    });

    document.getElementById('bannerCropReset').addEventListener('click', () => {
        const coverZoom = getCoverZoom(canvas.width, canvas.height);
        bannerCrop = { cx: bannerNaturalW / 2, cy: bannerNaturalH / 2, zoom: coverZoom };
        zoomSlider.value = 100;
        document.getElementById('bannerZoomValue').textContent = '100%';
        drawBannerCanvas();
    });
}

function getCoverZoom(canvasW, canvasH) {
    if (!bannerNaturalW || !bannerNaturalH) return 1;
    const scaleW = canvasW / bannerNaturalW;
    const scaleH = canvasH / bannerNaturalH;
    return Math.max(scaleW, scaleH);
}

function computeCoverZoom(canvasW, canvasH) {
    const cz = getCoverZoom(canvasW, canvasH);
    if (bannerCrop.zoom === 1.0 || bannerCrop.zoom < cz) {
        bannerCrop.zoom = cz;
    }
}

function clampCrop(canvasW, canvasH) {
    if (!bannerNaturalW) return;
    const z = bannerCrop.zoom;
    const minCx = canvasW / (2 * z);
    const maxCx = bannerNaturalW - canvasW / (2 * z);
    const minCy = canvasH / (2 * z);
    const maxCy = bannerNaturalH - canvasH / (2 * z);
    bannerCrop.cx = Math.max(minCx, Math.min(maxCx, bannerCrop.cx));
    bannerCrop.cy = Math.max(minCy, Math.min(maxCy, bannerCrop.cy));
}

function drawBannerCanvas() {
    const canvas = document.getElementById('bannerCropCanvas');
    if (!canvas || !bannerCropOriginalSrc || !bannerNaturalW) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    const img = _getBannerImg();
    if (!img) return;

    const z = bannerCrop.zoom;
    const drawX = W / 2 - bannerCrop.cx * z;
    const drawY = H / 2 - bannerCrop.cy * z;

    ctx.drawImage(img, drawX, drawY, bannerNaturalW * z, bannerNaturalH * z);
}

let _bannerImgCache = null;
let _bannerImgSrc = null;
function _getBannerImg() {
    if (_bannerImgSrc === bannerCropOriginalSrc && _bannerImgCache?.complete) return _bannerImgCache;
    const img = new Image();
    img.onload = () => { _bannerImgCache = img; _bannerImgSrc = bannerCropOriginalSrc; drawBannerCanvas(); };
    img.src = bannerCropOriginalSrc;
    _bannerImgSrc = bannerCropOriginalSrc;
    _bannerImgCache = img;
    return img.complete ? img : null;
}

function setupBannerCanvasInteractions(viewport, canvas) {
    let isDragging = false;
    let lastMouse = { x: 0, y: 0 };

    viewport.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDragging = true;
        lastMouse = { x: e.clientX, y: e.clientY };
        viewport.style.cursor = 'grabbing';
        e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const rect = viewport.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const dx = (e.clientX - lastMouse.x) * scaleX / bannerCrop.zoom;
        const dy = (e.clientY - lastMouse.y) * scaleY / bannerCrop.zoom;
        lastMouse = { x: e.clientX, y: e.clientY };
        bannerCrop.cx -= dx;
        bannerCrop.cy -= dy;
        clampCrop(canvas.width, canvas.height);
        drawBannerCanvas();
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) { isDragging = false; viewport.style.cursor = 'grab'; }
    });

    viewport.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        isDragging = true;
        lastMouse = { x: t.clientX, y: t.clientY };
        e.preventDefault();
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const t = e.touches[0];
        const rect = viewport.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const dx = (t.clientX - lastMouse.x) * scaleX / bannerCrop.zoom;
        const dy = (t.clientY - lastMouse.y) * scaleY / bannerCrop.zoom;
        lastMouse = { x: t.clientX, y: t.clientY };
        bannerCrop.cx -= dx;
        bannerCrop.cy -= dy;
        clampCrop(canvas.width, canvas.height);
        drawBannerCanvas();
    }, { passive: true });

    window.addEventListener('touchend', () => { isDragging = false; });
}

async function removeBanner() {
    const ok = await showConfirm({
        title: 'Remove Banner',
        message: 'Remove the current banner image?',
        details: 'You\'ll need to upload a new one before saving.',
        confirmText: 'Remove',
        cancelText: 'Keep',
        confirmClass: 'btn-danger',
    });
    if (!ok) return;
    bannerImage = null;
    bannerCropOriginalSrc = null;
    bannerNaturalW = 0;
    bannerNaturalH = 0;
    bannerCrop = { cx: 0, cy: 0, zoom: 1 };
    _bannerImgCache = null;
    _bannerImgSrc = null;
    if (editMode) editExistingBanner = null;
    document.getElementById('bannerPreview').innerHTML = '';
}

function bakeBannerCrop() {
    return new Promise((resolve) => {
        const OUTPUT_W = 1200;
        const OUTPUT_H = Math.round(OUTPUT_W * 9 / 16);

        const previewCanvas = document.getElementById('bannerCropCanvas');
        const previewW = previewCanvas ? previewCanvas.width : OUTPUT_W;

        const outputZoom = bannerCrop.zoom * (OUTPUT_W / previewW);

        const canvas = document.createElement('canvas');
        canvas.width = OUTPUT_W;
        canvas.height = OUTPUT_H;
        const ctx = canvas.getContext('2d');

        const img = new Image();
        img.onload = () => {
            const ox = OUTPUT_W / 2 - bannerCrop.cx * outputZoom;
            const oy = OUTPUT_H / 2 - bannerCrop.cy * outputZoom;
            ctx.drawImage(img, ox, oy, bannerNaturalW * outputZoom, bannerNaturalH * outputZoom);
            resolve(canvas.toDataURL('image/jpeg', 0.92));
        };
        img.src = bannerCropOriginalSrc;
    });
}

// ── GALLERY IMAGES ────────────────────────────────────────────────────────────
function updateEditImagePreviews() {
    const previewContainer = document.getElementById('imagePreviews');
    previewContainer.innerHTML = '';

    editExistingImages.forEach((img, index) => {
        const preview = document.createElement('div');
        preview.className = 'image-preview-item';
        preview.innerHTML = `
            <img src="${img.data}" alt="${escapeHtml(img.name)}">
            <div class="preview-overlay">
                <button type="button" class="remove-image" onclick="removeExistingImage(${index})"><span>×</span></button>
            </div>
            <div class="preview-info">
                <p class="preview-name">${escapeHtml(img.name)}</p>
                <p class="preview-size">Existing</p>
            </div>`;
        previewContainer.appendChild(preview);
    });

    selectedFiles.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.createElement('div');
            preview.className = 'image-preview-item';
            preview.innerHTML = `
                <img src="${e.target.result}" alt="${escapeHtml(file.name)}">
                <div class="preview-overlay">
                    <button type="button" class="remove-image" onclick="removeImage(${index})"><span>×</span></button>
                </div>
                <div class="preview-info">
                    <p class="preview-name">${escapeHtml(file.name)}</p>
                    <p class="preview-size">${(file.size / 1024).toFixed(1)} KB (New)</p>
                </div>`;
            previewContainer.appendChild(preview);
        };
        reader.readAsDataURL(file);
    });
}

async function removeExistingImage(index) {
    const img = editExistingImages[index];
    const ok = await showConfirm({
        title: 'Remove Image',
        message: `Remove <strong style="color:var(--text-primary)">${escapeHtml(img?.name || 'this image')}</strong> from the gallery?`,
        details: 'This change takes effect when you save the post.',
        confirmText: 'Remove',
        cancelText: 'Keep',
        confirmClass: 'btn-danger',
    });
    if (!ok) return;
    editExistingImages.splice(index, 1);
    updateEditImagePreviews();
}

// ── DELETE ────────────────────────────────────────────────────────────────────
async function deletePost(postId) {
    const post = allPosts[postId];
    if (!post) { alert('Post not found.'); return; }
    const ok = await showConfirm({
        title: 'Delete Post',
        message: `Are you sure you want to delete <strong style="color:var(--text-primary)">"${escapeHtml(post.title)}"</strong>?`,
        details: 'This action cannot be undone. The post will be permanently removed.',
        confirmText: '🗑️ Delete',
        cancelText: 'Cancel',
        confirmClass: 'btn-danger',
    });
    if (!ok) return;
    try {
        await remove(ref(database, `posts/${postId}`));
        showToast('✓ Post deleted!', 'success');
    } catch (error) {
        console.error(error);
        showToast('✗ Error deleting post: ' + error.message, 'error');
    }
}

// ── MODALS ────────────────────────────────────────────────────────────────────
function closePostModal() {
    document.getElementById('postModal').classList.remove('active');
    document.body.style.overflow = 'auto';
    currentModalPostId = null;
}

function editPostFromModal() {
    if (currentModalPostId) { closePostModal(); editPost(currentModalPostId); }
}

function deletePostFromModal() {
    if (currentModalPostId) { const id = currentModalPostId; closePostModal(); deletePost(id); }
}

function openAddPostModal() {
    editMode = false;
    editingPostId = null;
    editExistingImages = [];
    editExistingBanner = null;
    bannerCrop = { cx: 0, cy: 0, zoom: 1 };
    bannerCropOriginalSrc = null;
    bannerNaturalW = 0; bannerNaturalH = 0;
    _bannerImgCache = null; _bannerImgSrc = null;
    bannerImage = null;
    _formSaved = false;
    document.querySelector('#addPostModal .modal-header h2').textContent = 'Add New Post';
    document.getElementById('submitBtnText').textContent = 'Create Post';
    renderCategoryCheckboxes();
    document.getElementById('addPostModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

async function closeAddPostModal() {
    const title = document.getElementById('postTitle')?.value?.trim();
    const desc = document.getElementById('postDescription')?.value?.trim();
    const hasChanges = !_formSaved && (title || desc || bannerCropOriginalSrc || selectedFiles.length > 0);

    if (hasChanges) {
        const ok = await showConfirm({
            title: 'Discard Changes?',
            message: 'You have unsaved changes. Are you sure you want to close without saving?',
            details: 'All your changes will be lost.',
            confirmText: 'Discard',
            cancelText: 'Keep Editing',
            confirmClass: 'btn-warning',
        });
        if (!ok) return;
    }
    closeAddPostModalSilent();
}

// Called after a successful save — no confirmation prompt, no resetForm (already done)
function closeAddPostModalSilent() {
    _formSaved = false;
    document.getElementById('addPostModal').classList.remove('active');
    document.body.style.overflow = 'auto';
}

function setupModalClickOutside() {
    window.addEventListener('click', (e) => {
        const postModal = document.getElementById('postModal');
        const addPostModal = document.getElementById('addPostModal');
        const imageViewer = document.getElementById('imageViewer');
        const highlightPicker = document.getElementById('highlightPickerModal');
        if (e.target === postModal) closePostModal();
        if (e.target === addPostModal) closeAddPostModal();
        if (e.target === imageViewer) closeImageViewer();
        if (e.target === highlightPicker) closeHighlightPicker();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const imageViewer = document.getElementById('imageViewer');
        const postModal = document.getElementById('postModal');
        const addPostModal = document.getElementById('addPostModal');
        const highlightPicker = document.getElementById('highlightPickerModal');
        if (imageViewer.style.display === 'flex') closeImageViewer();
        else if (highlightPicker?.classList.contains('active')) closeHighlightPicker();
        else if (postModal.classList.contains('active')) closePostModal();
        else if (addPostModal.classList.contains('active')) closeAddPostModal();
    });
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
        searchTimeout = setTimeout(applyFiltersAndDisplay, 300);
    });
    categoryFilter.addEventListener('change', applyFiltersAndDisplay);
    sortFilter.addEventListener('change', applyFiltersAndDisplay);
    clearFilters.addEventListener('click', () => {
        searchInput.value = '';
        categoryFilter.value = '';
        sortFilter.value = 'newest';
        applyFiltersAndDisplay();
    });
}

// ── FILE INPUT ────────────────────────────────────────────────────────────────
function setupFileInput() {
    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        const maxFiles = 5;
        const maxSize = 1 * 1024 * 1024;
        const totalImages = editExistingImages.length + selectedFiles.length + files.length;
        if (totalImages > maxFiles) { alert(`Max ${maxFiles} images total`); fileInput.value = ''; return; }

        let hasErrors = false;
        files.forEach(file => {
            if (file.size > maxSize) { alert(`${file.name} is too large (max 1MB)`); hasErrors = true; return; }
            if (!file.type.startsWith('image/')) { alert(`${file.name} is not an image`); hasErrors = true; return; }
            selectedFiles.push(file);
        });

        fileInput.value = '';
        if (!hasErrors) editMode ? updateEditImagePreviews() : updateImagePreviews();
    });
}

async function updateImagePreviews() {
    const previewContainer = document.getElementById('imagePreviews');
    previewContainer.innerHTML = '';
    if (selectedFiles.length === 0) return;

    selectedFiles.forEach((file, i) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.createElement('div');
            preview.className = 'image-preview-item';
            preview.innerHTML = `
                <img src="${e.target.result}" alt="${escapeHtml(file.name)}">
                <div class="preview-overlay">
                    <button type="button" class="remove-image" onclick="removeImage(${i})"><span>×</span></button>
                </div>
                <div class="preview-info">
                    <p class="preview-name">${escapeHtml(file.name)}</p>
                    <p class="preview-size">${(file.size / 1024).toFixed(1)} KB</p>
                </div>`;
            previewContainer.appendChild(preview);
        };
        reader.readAsDataURL(file);
    });
}

async function removeImage(index) {
    const file = selectedFiles[index];
    const ok = await showConfirm({
        title: 'Remove Image',
        message: `Remove <strong style="color:var(--text-primary)">${escapeHtml(file?.name || 'this image')}</strong> from the gallery?`,
        confirmText: 'Remove',
        cancelText: 'Keep',
        confirmClass: 'btn-danger',
    });
    if (!ok) return;
    selectedFiles.splice(index, 1);
    editMode ? updateEditImagePreviews() : updateImagePreviews();
}

// ── POST FORM ─────────────────────────────────────────────────────────────────
function setupPostForm() {
    const form = document.getElementById('postForm');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) { alert('You must be logged in'); return; }

        const title = document.getElementById('postTitle').value.trim();
        const categories = getSelectedCategories();
        const description = document.getElementById('postDescription').value.trim();
        const messageDiv = document.getElementById('formMessage');
        const submitBtn = document.getElementById('submitBtn');
        const submitBtnText = document.getElementById('submitBtnText');

        if (!title || categories.length === 0 || !description) {
            messageDiv.innerHTML = '<div class="error">Please fill in all required fields and select at least one category</div>';
            messageDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            return;
        }

        const hasBanner = bannerCropOriginalSrc || (editMode && editExistingBanner?.data);
        if (!hasBanner) {
            messageDiv.innerHTML = '<div class="error">Please select a banner image</div>';
            return;
        }
        if (!bannerCropOriginalSrc && editMode && editExistingBanner?.data) {
            bannerCropOriginalSrc = editExistingBanner.data;
        }

        // Lock the button for the entire operation — never re-enable on success
        submitBtn.disabled = true;
        submitBtnText.textContent = editMode ? 'Updating...' : 'Creating...';
        messageDiv.innerHTML = '';

        try {
            const bakedData = await bakeBannerCrop();

            const bannerData = {
                data: bakedData,
                originalData: bannerCropOriginalSrc,
                name: bannerImage?.name || editExistingBanner?.name || 'banner.jpg',
                crop: { ...bannerCrop },
            };

            const newImages = await Promise.all(selectedFiles.map(f => convertToBase64(f)));
            const allImages = [...editExistingImages, ...newImages];

            const postData = {
                title,
                category: categories[0],
                categories,
                description,
                bannerImage: bannerData,
                images: allImages,
                imageCount: allImages.length,
                updatedAt: Date.now()
            };

            if (editMode) {
                await update(ref(database, `posts/${editingPostId}`), postData);
                messageDiv.innerHTML = '<div class="success">✓ Post updated successfully!</div>';
            } else {
                postData.createdAt = Date.now();
                await push(ref(database, 'posts'), postData);
                messageDiv.innerHTML = '<div class="success">✓ Post created successfully!</div>';
            }

            // Mark as saved so closeAddPostModal skips the "unsaved changes" prompt,
            // then reset the form state immediately to prevent duplicate submissions
            _formSaved = true;
            resetForm();
            setTimeout(() => closeAddPostModalSilent(), 1500);

        } catch (error) {
            // Only on error: re-enable so the user can retry
            submitBtn.disabled = false;
            submitBtnText.textContent = editMode ? 'Update Post' : 'Create Post';
            console.error('Submit error:', error);
            messageDiv.innerHTML = `<div class="error" style="white-space:pre-wrap;">✗ Error: ${error.message || error.code || JSON.stringify(error)}<br><small style="opacity:0.7;">Check console (F12) for details</small></div>`;
            messageDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    });
}

function convertToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve({ data: e.target.result, name: file.name });
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function resetForm() {
    document.getElementById('postForm').reset();
    document.getElementById('formMessage').innerHTML = '';
    document.getElementById('imagePreviews').innerHTML = '';
    document.getElementById('bannerPreview').innerHTML = '';
    selectedFiles = [];
    bannerImage = null;
    bannerCropOriginalSrc = null;
    bannerNaturalW = 0; bannerNaturalH = 0;
    bannerCrop = { cx: 0, cy: 0, zoom: 1 };
    _bannerImgCache = null; _bannerImgSrc = null;
    editMode = false;
    editingPostId = null;
    editExistingImages = [];
    editExistingBanner = null;
    _formSaved = false;
    renderCategoryCheckboxes();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
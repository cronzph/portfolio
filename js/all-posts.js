// All Posts Page JavaScript
import { database } from './firebase-config.js';
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

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
});

// Load all posts
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
            const postData = {
                id: childSnapshot.key,
                ...childSnapshot.val()
            };
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

// Apply filters and display posts
function applyFiltersAndDisplay() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const categoryFilter = document.getElementById('categoryFilter').value;
    const sortFilter = document.getElementById('sortFilter').value;
    const grid = document.getElementById('allPostsGrid');

    // Filter posts
    filteredPosts = {};
    Object.keys(allPosts).forEach(key => {
        const post = allPosts[key];
        const matchesSearch = !searchTerm || 
            post.title.toLowerCase().includes(searchTerm) || 
            post.description.toLowerCase().includes(searchTerm);
        const matchesCategory = !categoryFilter || post.category === categoryFilter;

        if (matchesSearch && matchesCategory) {
            filteredPosts[key] = post;
        }
    });

    // Convert to array and sort
    let postsArray = Object.values(filteredPosts);

    switch(sortFilter) {
        case 'newest':
            postsArray.sort((a, b) => b.createdAt - a.createdAt);
            break;
        case 'oldest':
            postsArray.sort((a, b) => a.createdAt - b.createdAt);
            break;
        case 'title-asc':
            postsArray.sort((a, b) => a.title.localeCompare(b.title));
            break;
        case 'title-desc':
            postsArray.sort((a, b) => b.title.localeCompare(a.title));
            break;
    }

    // Update count
    updateResultsCount(postsArray.length);

    // Display posts
    grid.innerHTML = '';
    
    if (postsArray.length === 0) {
        grid.innerHTML = '<div class="empty-state"><p>No projects match your search criteria.</p></div>';
        return;
    }

    postsArray.forEach(post => {
        const card = createPostCard(post);
        grid.appendChild(card);
    });
}

// Create post card with banner image
function createPostCard(post) {
    const card = document.createElement('div');
    card.className = 'post-card';
    card.onclick = () => openPostDetail(post.id);

    const date = new Date(post.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Use banner image if available, otherwise fallback to first gallery image
    const imageUrl = post.bannerImage?.data || (post.images && post.images[0]?.data) || post.imageData;

    card.innerHTML = `
        ${imageUrl 
            ? `<div class="post-banner">
                <img src="${imageUrl}" alt="${escapeHtml(post.title)}">
               </div>` 
            : '<div class="post-banner"><div class="no-image">No Image</div></div>'}
        <div class="post-content">
            <span class="post-category">${escapeHtml(post.category)}</span>
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

// Open post detail modal
function openPostDetail(postId) {
    const post = allPosts[postId];
    if (!post) return;

    currentModalPost = post;

    document.getElementById('modalTitle').textContent = post.title;
    document.getElementById('modalCategory').textContent = post.category;
    document.getElementById('modalDescription').textContent = post.description;

    const date = new Date(post.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    document.getElementById('modalDate').textContent = `📅 ${date}`;

    // Display banner image
    const modalBanner = document.getElementById('modalBanner');
    if (post.bannerImage) {
        modalBanner.innerHTML = `<img src="${post.bannerImage.data}" alt="${escapeHtml(post.title)}">`;
        modalBanner.style.display = 'block';
    } else {
        modalBanner.style.display = 'none';
    }

    // Display gallery images
    const modalGallery = document.getElementById('modalGallery');
    if (post.images && post.images.length > 0) {
        let galleryHtml = '<h3>Gallery</h3><div class="gallery-grid">';
        post.images.forEach((img, index) => {
            galleryHtml += `
                <div class="gallery-item" onclick="viewImageFullSize('${img.data}')">
                    <img src="${img.data}" alt="${escapeHtml(post.title)} - ${index + 1}">
                </div>
            `;
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

// Close modal
function closeModal() {
    document.getElementById('postModal').classList.remove('active');
    document.body.style.overflow = 'auto';
    currentModalPost = null;
}

// Setup search and filters
function setupSearchAndFilters() {
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const sortFilter = document.getElementById('sortFilter');
    const clearFilters = document.getElementById('clearFilters');

    // Debounce search input
    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            applyFiltersAndDisplay();
        }, 300);
    });

    categoryFilter.addEventListener('change', applyFiltersAndDisplay);
    sortFilter.addEventListener('change', applyFiltersAndDisplay);

    clearFilters.addEventListener('click', () => {
        searchInput.value = '';
        categoryFilter.value = '';
        sortFilter.value = 'newest';
        applyFiltersAndDisplay();
    });

    // Close modal on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.getElementById('postModal').classList.contains('active')) {
            closeModal();
        }
    });
}

// Update results count
function updateResultsCount(count) {
    const resultsCount = document.getElementById('resultsCount');
    resultsCount.textContent = `${count} project${count !== 1 ? 's' : ''} found`;
}

// Truncate text
function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// Escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// View image full size
window.viewImageFullSize = function(imageSrc) {
    const viewer = document.createElement('div');
    viewer.id = 'imageViewer';
    viewer.style.cssText = `
        display: flex;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.95);
        z-index: 10000;
        align-items: center;
        justify-content: center;
        padding: 2rem;
    `;
    viewer.innerHTML = `
        <button onclick="this.parentElement.remove(); document.body.style.overflow='hidden';" style="position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3); color: white; font-size: 2rem; width: 50px; height: 50px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;">&times;</button>
        <img src="${imageSrc}" style="max-width: 90%; max-height: 90%; object-fit: contain; border-radius: 8px;">
    `;
    viewer.onclick = (e) => {
        if (e.target === viewer) {
            viewer.remove();
            document.body.style.overflow = 'hidden';
        }
    };
    document.body.appendChild(viewer);
};
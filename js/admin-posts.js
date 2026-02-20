// Admin Posts JavaScript
import { auth, database } from './firebase-config.js';
import { signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { ref, onValue, remove, push, update } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupAuthStateListener();
    setupModalClickOutside();
    setupPostForm();
    setupFileInput();
    setupBannerInput();
    setupSearchAndFilters();
    createImageViewerModal();
});

// Create image viewer modal
function createImageViewerModal() {
    const viewer = document.createElement('div');
    viewer.id = 'imageViewer';
    viewer.style.cssText = `
        display: none;
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
        <button onclick="closeImageViewer()" style="position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3); color: white; font-size: 2rem; width: 50px; height: 50px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;">&times;</button>
        <img id="viewerImage" style="max-width: 90%; max-height: 90%; object-fit: contain; border-radius: 8px;">
    `;
    document.body.appendChild(viewer);
}

// View image full size
function viewImageFullSize(imageSrc) {
    const viewer = document.getElementById('imageViewer');
    const img = document.getElementById('viewerImage');
    img.src = imageSrc;
    viewer.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// Close image viewer
function closeImageViewer() {
    const viewer = document.getElementById('imageViewer');
    viewer.style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Auth state observer
function setupAuthStateListener() {
    onAuthStateChanged(auth, async (user) => {
        currentUser = user;
        
        if (user) {
            await loadSidebar(); // Load sidebar before rendering content
            document.getElementById('userEmail').textContent = user.email;
            loadAdminPosts();
        } else {
            window.location.href = 'admin.html';
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

// Load and display admin posts
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
    });
}

// Apply filters and display posts
function applyFiltersAndDisplay() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const categoryFilter = document.getElementById('categoryFilter')?.value || '';
    const sortFilter = document.getElementById('sortFilter')?.value || 'newest';
    const list = document.getElementById('adminPostsList');
    const countBadge = document.getElementById('postCount');

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
    countBadge.textContent = postsArray.length;

    // Display posts
    list.innerHTML = '';
    
    if (postsArray.length === 0) {
        list.innerHTML = '<div class="empty-state"><p>No posts match your search criteria.</p></div>';
        return;
    }

    postsArray.forEach(post => {
        const item = createPostListItem(post);
        list.appendChild(item);
    });
}

// Create post list item
function createPostListItem(post) {
    const item = document.createElement('div');
    item.className = 'post-list-item';

    const date = new Date(post.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const imageCount = post.imageCount || 0;
    const bannerImageHtml = post.bannerImage ? 
        `<div class="post-banner">
            <img src="${post.bannerImage.data}" alt="${escapeHtml(post.title)}">
        </div>` : '';

    item.innerHTML = `
        ${bannerImageHtml}
        <div class="post-list-header">
            <div>
                <h3 class="post-list-title">${escapeHtml(post.title)}</h3>
                <span class="post-list-category">${post.category}</span>
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
        </div>
    `;

    return item;
}

// View post in modal
function viewPost(postId) {
    const post = allPosts[postId];
    
    if (!post) {
        alert('Post not found. Please refresh the page.');
        return;
    }

    currentModalPostId = postId;
    
    document.getElementById('modalTitle').textContent = post.title;
    document.getElementById('modalCategory').textContent = post.category;
    document.getElementById('modalDescription').textContent = post.description;
    
    const date = new Date(post.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    document.getElementById('modalDate').textContent = `Created: ${date}`;
    
    const modalImage = document.getElementById('modalImage');
    let imagesHtml = '';
    
    // Show banner image
    if (post.bannerImage) {
        imagesHtml += `
            <div style="margin-bottom: 1.5rem;">
                <h3 style="margin-bottom: 0.5rem; color: var(--text-primary);">Banner Image</h3>
                <div style="cursor: pointer; border-radius: 12px; overflow: hidden; border: 2px solid var(--accent-primary); aspect-ratio: 16/9; max-width: 800px;" onclick="viewImageFullSize('${post.bannerImage.data}')">
                    <img src="${post.bannerImage.data}" alt="${escapeHtml(post.title)} - Banner" style="width: 100%; height: 100%; object-fit: cover; display: block;">
                </div>
            </div>
        `;
    }
    
    // Show gallery images
    if (post.images && post.images.length > 0) {
        imagesHtml += `
            <div>
                <h3 style="margin-bottom: 0.5rem; color: var(--text-primary);">Gallery Images</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem;">
        `;
        post.images.forEach((img, index) => {
            imagesHtml += `
                <div style="cursor: pointer; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color); transition: all 0.3s;" onclick="viewImageFullSize('${img.data}')" onmouseover="this.style.borderColor='var(--accent-primary)'" onmouseout="this.style.borderColor='var(--border-color)'">
                    <img src="${img.data}" alt="${escapeHtml(post.title)} - ${index + 1}" style="width: 100%; height: 200px; object-fit: cover; display: block;">
                </div>
            `;
        });
        imagesHtml += '</div></div>';
    }
    
    if (imagesHtml) {
        modalImage.innerHTML = imagesHtml;
        modalImage.style.display = 'block';
    } else {
        modalImage.innerHTML = '<div class="no-image">📷 No images available</div>';
        modalImage.style.display = 'block';
    }
    
    document.getElementById('postModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Edit post
function editPost(postId) {
    const post = allPosts[postId];
    
    if (!post) {
        alert('Post not found. Please refresh the page.');
        return;
    }

    editMode = true;
    editingPostId = postId;
    editExistingImages = post.images ? [...post.images] : [];
    editExistingBanner = post.bannerImage ? {...post.bannerImage} : null;
    selectedFiles = [];
    bannerImage = null;

    // Populate form
    document.getElementById('postTitle').value = post.title;
    document.getElementById('postCategory').value = post.category;
    document.getElementById('postDescription').value = post.description;

    // Update modal title
    document.querySelector('#addPostModal .modal-header h2').textContent = 'Edit Post';
    document.getElementById('submitBtnText').textContent = 'Update Post';

    // Show existing images
    updateBannerPreview();
    updateEditImagePreviews();

    // Open modal
    document.getElementById('addPostModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Setup banner input
function setupBannerInput() {
    const bannerInput = document.getElementById('bannerInput');
    const maxSize = 1 * 1024 * 1024;

    bannerInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        
        if (!file) return;

        if (file.size > maxSize) {
            alert(`File is too large. Max size is 1MB`);
            bannerInput.value = '';
            return;
        }

        if (!file.type.startsWith('image/')) {
            alert(`File is not an image`);
            bannerInput.value = '';
            return;
        }

        bannerImage = file;
        bannerInput.value = '';
        updateBannerPreview();
    });
}

// Update banner preview
function updateBannerPreview() {
    const previewContainer = document.getElementById('bannerPreview');
    previewContainer.innerHTML = '';

    // Show existing banner in edit mode
    if (editMode && editExistingBanner && !bannerImage) {
        const preview = document.createElement('div');
        preview.className = 'banner-preview-item';
        preview.innerHTML = `
            <img src="${editExistingBanner.data}" alt="Banner">
            <button type="button" class="remove-banner" onclick="removeBanner()" title="Remove banner">
                <span>×</span>
            </button>
            <div class="banner-label">Current Banner</div>
        `;
        previewContainer.appendChild(preview);
        return;
    }

    // Show new banner
    if (bannerImage) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.createElement('div');
            preview.className = 'banner-preview-item';
            preview.innerHTML = `
                <img src="${e.target.result}" alt="Banner Preview">
                <button type="button" class="remove-banner" onclick="removeBanner()" title="Remove banner">
                    <span>×</span>
                </button>
                <div class="banner-label">${escapeHtml(bannerImage.name)} - ${(bannerImage.size / 1024).toFixed(1)} KB</div>
            `;
            previewContainer.appendChild(preview);
        };
        reader.readAsDataURL(bannerImage);
    }
}

// Remove banner
function removeBanner() {
    bannerImage = null;
    if (editMode) {
        editExistingBanner = null;
    }
    updateBannerPreview();
}

// Update image previews for edit mode
function updateEditImagePreviews() {
    const previewContainer = document.getElementById('imagePreviews');
    previewContainer.innerHTML = '';

    // Show existing images
    editExistingImages.forEach((img, index) => {
        const preview = document.createElement('div');
        preview.className = 'image-preview-item';
        preview.innerHTML = `
            <img src="${img.data}" alt="${escapeHtml(img.name)}">
            <div class="preview-overlay">
                <button type="button" class="remove-image" onclick="removeExistingImage(${index})" title="Remove image">
                    <span>×</span>
                </button>
            </div>
            <div class="preview-info">
                <p class="preview-name">${escapeHtml(img.name)}</p>
                <p class="preview-size">Existing</p>
            </div>
        `;
        previewContainer.appendChild(preview);
    });

    // Show new images
    selectedFiles.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.createElement('div');
            preview.className = 'image-preview-item';
            preview.innerHTML = `
                <img src="${e.target.result}" alt="${escapeHtml(file.name)}">
                <div class="preview-overlay">
                    <button type="button" class="remove-image" onclick="removeImage(${index})" title="Remove image">
                        <span>×</span>
                    </button>
                </div>
                <div class="preview-info">
                    <p class="preview-name">${escapeHtml(file.name)}</p>
                    <p class="preview-size">${(file.size / 1024).toFixed(1)} KB (New)</p>
                </div>
            `;
            previewContainer.appendChild(preview);
        };
        reader.readAsDataURL(file);
    });
}

// Remove existing image
function removeExistingImage(index) {
    editExistingImages.splice(index, 1);
    updateEditImagePreviews();
}

// Delete post
async function deletePost(postId) {
    const post = allPosts[postId];
    
    if (!post) {
        alert('Post not found. Please refresh the page.');
        return;
    }

    if (!confirm(`Are you sure you want to delete "${post.title}"?\n\nThis action cannot be undone.`)) {
        return;
    }

    try {
        await remove(ref(database, `posts/${postId}`));
        
        const tempMsg = document.createElement('div');
        tempMsg.className = 'success';
        tempMsg.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; padding: 1rem 2rem; border-radius: 8px;';
        tempMsg.textContent = '✓ Post deleted successfully!';
        document.body.appendChild(tempMsg);
        
        setTimeout(() => {
            tempMsg.remove();
        }, 3000);

    } catch (error) {
        console.error('Error deleting post:', error);
        alert('Error deleting post: ' + error.message);
    }
}

// Close post modal
function closePostModal() {
    document.getElementById('postModal').classList.remove('active');
    document.body.style.overflow = 'auto';
    currentModalPostId = null;
}

// Edit from modal
function editPostFromModal() {
    if (currentModalPostId) {
        closePostModal();
        editPost(currentModalPostId);
    }
}

// Delete from modal
function deletePostFromModal() {
    if (currentModalPostId) {
        const postId = currentModalPostId;
        closePostModal();
        deletePost(postId);
    }
}

// Open/Close Add Post Modal
function openAddPostModal() {
    editMode = false;
    editingPostId = null;
    editExistingImages = [];
    editExistingBanner = null;
    document.querySelector('#addPostModal .modal-header h2').textContent = 'Add New Post';
    document.getElementById('submitBtnText').textContent = 'Create Post';
    document.getElementById('addPostModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeAddPostModal() {
    document.getElementById('addPostModal').classList.remove('active');
    document.body.style.overflow = 'auto';
    resetForm();
}

// Setup modal click outside
function setupModalClickOutside() {
    window.addEventListener('click', (e) => {
        const postModal = document.getElementById('postModal');
        const addPostModal = document.getElementById('addPostModal');
        const imageViewer = document.getElementById('imageViewer');
        
        if (e.target === postModal) {
            closePostModal();
        }
        if (e.target === addPostModal) {
            closeAddPostModal();
        }
        if (e.target === imageViewer) {
            closeImageViewer();
        }
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const postModal = document.getElementById('postModal');
            const addPostModal = document.getElementById('addPostModal');
            const imageViewer = document.getElementById('imageViewer');
            
            if (imageViewer.style.display === 'flex') {
                closeImageViewer();
            } else if (postModal.classList.contains('active')) {
                closePostModal();
            } else if (addPostModal.classList.contains('active')) {
                closeAddPostModal();
            }
        }
    });
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
}

// File input handler
function setupFileInput() {
    const fileInput = document.getElementById('fileInput');

    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        const maxFiles = 5;
        const maxSize = 1 * 1024 * 1024;

        const totalImages = editExistingImages.length + selectedFiles.length + files.length;
        
        if (totalImages > maxFiles) {
            alert(`You can only upload up to ${maxFiles} images total`);
            fileInput.value = '';
            return;
        }

        let hasErrors = false;
        files.forEach(file => {
            if (file.size > maxSize) {
                alert(`${file.name} is too large. Max size is 1MB`);
                hasErrors = true;
                return;
            }

            if (!file.type.startsWith('image/')) {
                alert(`${file.name} is not an image file`);
                hasErrors = true;
                return;
            }

            selectedFiles.push(file);
        });

        fileInput.value = '';
        
        if (!hasErrors) {
            if (editMode) {
                updateEditImagePreviews();
            } else {
                updateImagePreviews();
            }
        }
    });
}

// Update image previews
async function updateImagePreviews() {
    const previewContainer = document.getElementById('imagePreviews');
    previewContainer.innerHTML = '';

    if (selectedFiles.length === 0) {
        return;
    }

    for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const reader = new FileReader();

        reader.onload = (e) => {
            const preview = document.createElement('div');
            preview.className = 'image-preview-item';
            preview.innerHTML = `
                <img src="${e.target.result}" alt="${escapeHtml(file.name)}">
                <div class="preview-overlay">
                    <button type="button" class="remove-image" onclick="removeImage(${i})" title="Remove image">
                        <span>×</span>
                    </button>
                </div>
                <div class="preview-info">
                    <p class="preview-name">${escapeHtml(file.name)}</p>
                    <p class="preview-size">${(file.size / 1024).toFixed(1)} KB</p>
                </div>
            `;
            previewContainer.appendChild(preview);
        };

        reader.readAsDataURL(file);
    }
}

// Remove image from selection
function removeImage(index) {
    selectedFiles.splice(index, 1);
    if (editMode) {
        updateEditImagePreviews();
    } else {
        updateImagePreviews();
    }
}

// Post form handler
function setupPostForm() {
    const form = document.getElementById('postForm');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) {
            alert('You must be logged in');
            return;
        }

        const title = document.getElementById('postTitle').value.trim();
        const category = document.getElementById('postCategory').value;
        const description = document.getElementById('postDescription').value.trim();
        const messageDiv = document.getElementById('formMessage');
        const submitBtn = document.getElementById('submitBtn');
        const submitBtnText = document.getElementById('submitBtnText');

        if (!title || !category || !description) {
            messageDiv.innerHTML = '<div class="error">Please fill in all required fields</div>';
            return;
        }

        // Check for banner image
        const hasBanner = bannerImage || (editMode && editExistingBanner);
        if (!hasBanner) {
            messageDiv.innerHTML = '<div class="error">Please select a banner image</div>';
            return;
        }

        submitBtn.disabled = true;
        submitBtnText.textContent = editMode ? 'Updating...' : 'Creating...';
        messageDiv.innerHTML = '';

        try {
            // Convert banner image to Base64
            let bannerData;
            if (bannerImage) {
                bannerData = await convertToBase64(bannerImage);
            } else if (editMode && editExistingBanner) {
                bannerData = editExistingBanner;
            }

            // Convert new gallery files to Base64
            const newImagePromises = selectedFiles.map(file => convertToBase64(file));
            const newImages = await Promise.all(newImagePromises);

            // Combine existing and new gallery images
            const allImages = [...editExistingImages, ...newImages];

            const postData = {
                title,
                category,
                description,
                bannerImage: bannerData,
                images: allImages,
                imageCount: allImages.length,
                updatedAt: Date.now()
            };

            if (editMode) {
                // Update existing post
                await update(ref(database, `posts/${editingPostId}`), postData);
                messageDiv.innerHTML = '<div class="success">✓ Post updated successfully!</div>';
            } else {
                // Create new post
                postData.createdAt = Date.now();
                await push(ref(database, 'posts'), postData);
                messageDiv.innerHTML = '<div class="success">✓ Post created successfully!</div>';
            }

            setTimeout(() => {
                closeAddPostModal();
            }, 1500);

        } catch (error) {
            console.error('Error saving post:', error);
            messageDiv.innerHTML = `<div class="error">✗ Error: ${error.message}</div>`;
        } finally {
            submitBtn.disabled = false;
            submitBtnText.textContent = editMode ? 'Update Post' : 'Create Post';
        }
    });
}

// Convert file to Base64
function convertToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            resolve({
                data: e.target.result,
                name: file.name
            });
        };

        reader.onerror = (error) => {
            reject(error);
        };

        reader.readAsDataURL(file);
    });
}

// Reset form
function resetForm() {
    document.getElementById('postForm').reset();
    document.getElementById('formMessage').innerHTML = '';
    document.getElementById('imagePreviews').innerHTML = '';
    document.getElementById('bannerPreview').innerHTML = '';
    selectedFiles = [];
    bannerImage = null;
    editMode = false;
    editingPostId = null;
    editExistingImages = [];
    editExistingBanner = null;
}

// Escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
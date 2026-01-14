// Portfolio Page JavaScript
import { database } from './firebase-config.js';
import { ref, onValue, push, set } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// Store all posts globally for modal access
let allPosts = {};

// Typing effect
const typingText = document.getElementById('typingText');
const roles = ['Editor', 'Developer', 'Creator', 'Innovator'];
let roleIndex = 0;
let charIndex = 0;
let isDeleting = false;

function typeEffect() {
    const currentRole = roles[roleIndex];
    
    if (isDeleting) {
        typingText.textContent = currentRole.substring(0, charIndex - 1);
        charIndex--;
    } else {
        typingText.textContent = currentRole.substring(0, charIndex + 1);
        charIndex++;
    }

    if (!isDeleting && charIndex === currentRole.length) {
        setTimeout(() => isDeleting = true, 2000);
    } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        roleIndex = (roleIndex + 1) % roles.length;
    }

    const typingSpeed = isDeleting ? 50 : 100;
    setTimeout(typeEffect, typingSpeed);
}

// Start typing effect
typeEffect();

// Load portfolio items
function loadPortfolio() {
    const postsRef = ref(database, 'posts');
    const grid = document.getElementById('portfolioGrid');

    // Keep the loading spinner visible initially
    console.log('Starting to load portfolio...');

    onValue(postsRef, (snapshot) => {
        console.log('Firebase snapshot received');
        console.log('Snapshot exists:', snapshot.exists());
        console.log('Snapshot data:', snapshot.val());
        
        // Clear loading spinner
        grid.innerHTML = '';
        allPosts = {};
        
        if (!snapshot.exists()) {
            console.log('No posts found in database');
            grid.innerHTML = `
                <div class="empty-state">
                    <h3>No projects yet</h3>
                    <p>Check back soon for new content!</p>
                </div>
            `;
            return;
        }

        // Convert to array and sort by date (newest first)
        const posts = [];
        snapshot.forEach((childSnapshot) => {
            const postData = {
                id: childSnapshot.key,
                ...childSnapshot.val()
            };
            posts.push(postData);
            allPosts[childSnapshot.key] = postData;
        });

        console.log(`Loaded ${posts.length} posts from Firebase`);
        posts.sort((a, b) => b.createdAt - a.createdAt);

        // Display only the latest 6 posts
        const latestPosts = posts.slice(0, 6);
        console.log(`Displaying ${latestPosts.length} latest posts`);
        
        latestPosts.forEach(post => {
            const card = createPostCard(post);
            grid.appendChild(card);
        });
    }, (error) => {
        console.error('Error loading portfolio:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        grid.innerHTML = `
            <div class="empty-state">
                <h3>Unable to load portfolio</h3>
                <p>Error: ${error.message}</p>
                <p style="font-size: 0.9em; color: var(--text-secondary); margin-top: 0.5rem;">Please check the console for details.</p>
            </div>
        `;
    });
}

// Create post card with banner image support and click handler
function createPostCard(post) {
    const card = document.createElement('div');
    card.className = 'post-card';
    card.onclick = () => openPostModal(post.id);

    const date = new Date(post.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Use banner image if available, otherwise fallback to first gallery image or old imageData
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

// Open post modal
function openPostModal(postId) {
    const post = allPosts[postId];
    if (!post) return;

    // Create modal if it doesn't exist
    let modal = document.getElementById('postViewModal');
    if (!modal) {
        modal = createPostModal();
        document.body.appendChild(modal);
    }

    // Populate modal
    document.getElementById('modalPostTitle').textContent = post.title;
    document.getElementById('modalPostCategory').textContent = post.category;
    document.getElementById('modalPostDescription').textContent = post.description;

    const date = new Date(post.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    document.getElementById('modalPostDate').textContent = `📅 ${date}`;

    // Display banner image
    const modalBanner = document.getElementById('modalPostBanner');
    if (post.bannerImage) {
        modalBanner.innerHTML = `<img src="${post.bannerImage.data}" alt="${escapeHtml(post.title)}">`;
        modalBanner.style.display = 'block';
    } else {
        modalBanner.style.display = 'none';
    }

    // Display gallery images
    const modalGallery = document.getElementById('modalPostGallery');
    if (post.images && post.images.length > 0) {
        let galleryHtml = '<h3>Gallery</h3><div class="modal-gallery-grid">';
        post.images.forEach((img, index) => {
            galleryHtml += `
                <div class="modal-gallery-item" onclick="viewImageFullSize('${img.data}')">
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

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Create post modal HTML
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
                    <span id="modalPostCategory" class="post-category"></span>
                </div>
                <div id="modalPostBanner" class="modal-banner"></div>
                <div class="modal-body">
                    <p id="modalPostDescription"></p>
                    <div class="modal-meta">
                        <span id="modalPostDate"></span>
                    </div>
                    <div id="modalPostGallery" class="modal-gallery"></div>
                </div>
            </div>
        </div>
    `;
    return modal;
}

// Close post modal
window.closePostModal = function() {
    const modal = document.getElementById('postViewModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
};

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
        <button onclick="this.parentElement.remove(); document.body.style.overflow='auto';" style="position: absolute; top: 20px; right: 20px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-secondary); font-size: 2rem; width: 50px; height: 50px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s;">&times;</button>
        <img src="${imageSrc}" style="max-width: 90%; max-height: 90%; object-fit: contain; border-radius: 8px;">
    `;
    viewer.onclick = (e) => {
        if (e.target === viewer) {
            viewer.remove();
            document.body.style.overflow = 'auto';
        }
    };
    document.body.appendChild(viewer);
};

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

// Contact form handling with Firebase
const contactForm = document.getElementById('contactForm');

// Only add event listener if contact form exists (not using Tally embed)
if (contactForm) {
    const submitBtn = document.getElementById('submitBtn');
    const formMessage = document.getElementById('formMessage');

    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Get form data
        const formData = {
            name: document.getElementById('name').value.trim(),
            email: document.getElementById('email').value.trim(),
            subject: document.getElementById('subject').value.trim(),
            message: document.getElementById('message').value.trim(),
            timestamp: Date.now(),
            status: 'unread'
        };

        // Validate form data
        if (!formData.name || !formData.email || !formData.subject || !formData.message) {
            showFormMessage('error', '✗ Please fill in all fields.');
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            showFormMessage('error', '✗ Please enter a valid email address.');
            return;
        }

        // Disable button and show loading state
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>📤 Sending...</span>';
        formMessage.style.display = 'none';

        try {
            // Save to Firebase Realtime Database
            const messagesRef = ref(database, 'messages');
            const newMessageRef = push(messagesRef);
            await set(newMessageRef, formData);
            
            // Clear form
            contactForm.reset();
            
            // Show success message
            showFormMessage('success', '✓ Message sent successfully! Thank you for reaching out. I\'ll get back to you soon.');
            
            // Auto-hide success message after 5 seconds
            setTimeout(() => {
                hideFormMessage();
            }, 5000);
        } catch (error) {
            console.error('Contact form error:', error);
            showFormMessage('error', '✗ Failed to send message. Please try again or contact me directly via email.');
            
            // Auto-hide error message after 7 seconds
            setTimeout(() => {
                hideFormMessage();
            }, 7000);
        } finally {
            // Re-enable button
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Send Message';
        }
    });

    // Helper function to show form messages
    function showFormMessage(type, message) {
        if (!formMessage) return;
        formMessage.className = `form-message ${type}`;
        formMessage.textContent = message;
        formMessage.style.display = 'block';
        
        // Smooth scroll to message
        formMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Helper function to hide form messages
    function hideFormMessage() {
        if (!formMessage) return;
        formMessage.style.display = 'none';
        formMessage.className = 'form-message';
        formMessage.textContent = '';
    }
} // End of contactForm if block

// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Close modal on escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closePostModal();
        const imageViewer = document.getElementById('imageViewer');
        if (imageViewer) {
            imageViewer.remove();
            document.body.style.overflow = 'auto';
        }
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadPortfolio();
});
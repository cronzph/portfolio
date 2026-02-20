/**
 * sidebar-loader.js
 * Fetches sidebar.html and injects it into #sidebarContainer,
 * then marks the current page's nav item as active.
 */
export async function loadSidebar() {
    const container = document.getElementById('sidebarContainer');
    if (!container) return;

    const response = await fetch('sidebar.html');
    container.innerHTML = await response.text();

    // Highlight the active nav item based on current filename
    const currentPage = location.pathname.split('/').pop().replace('.html', '');
    container.querySelectorAll('.nav-item[data-page]').forEach(link => {
        if (link.dataset.page === currentPage) {
            link.classList.add('active');
        }
    });
}
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

    // Theme toggle functionality - use shared ThemeManager if available
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        if (window.ThemeManager) {
            window.ThemeManager.setTheme(window.ThemeManager.getTheme());
            themeToggle.addEventListener('click', () => window.ThemeManager.toggleTheme());
        } else {
            // Fallback inline toggle
            const savedTheme = localStorage.getItem('siteTheme') || 'dark';
            document.documentElement.setAttribute('data-theme', savedTheme);
            themeToggle.addEventListener('click', () => {
                const current = document.documentElement.getAttribute('data-theme') || 'dark';
                const next = current === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', next);
                localStorage.setItem('siteTheme', next);
            });
        }
    }
}

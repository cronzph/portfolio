// Theme Manager - Applies to entire site
(function () {
    function getTheme() {
        return localStorage.getItem('siteTheme') || 'dark';
    }

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('siteTheme', theme);
        const btn = document.getElementById('themeToggle');
        if (btn) {
            btn.setAttribute('data-theme', theme);
            btn.title = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
        }
    }

    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        setTheme(current === 'dark' ? 'light' : 'dark');
    }

    // Apply saved theme immediately (before DOM ready to avoid flash)
    setTheme(getTheme());

    document.addEventListener('DOMContentLoaded', function () {
        setTheme(getTheme());
        const btn = document.getElementById('themeToggle');
        if (btn) {
            btn.addEventListener('click', toggleTheme);
        }
    });

    window.ThemeManager = { setTheme, toggleTheme, getTheme };
})();
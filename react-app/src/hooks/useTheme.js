import { useState, useEffect } from 'react';

export function useTheme() {
    const [theme, setThemeState] = useState(
        () => localStorage.getItem('siteTheme') || 'dark'
    );

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('siteTheme', theme);
    }, [theme]);

    const toggle = () => setThemeState(t => t === 'dark' ? 'light' : 'dark');
    return { theme, toggle };
}

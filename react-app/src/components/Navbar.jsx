import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

export default function Navbar({ theme, onToggleTheme }) {
    const [open, setOpen] = useState(false);
    const location = useLocation();
    const isHome = location.pathname === '/';

    const close = () => setOpen(false);

    // On home page use hash anchors; elsewhere use route links
    const navItems = isHome
        ? [
            { label: 'Home', to: '#home' },
            { label: 'Projects', to: '#portfolio' },
            { label: 'About', to: '#about' },
            { label: 'Contact', to: '#contact' },
            { label: 'Blog', to: '/blog', route: true },
        ]
        : [
            { label: 'Home', to: '/', route: true },
            { label: 'Projects', to: '/projects', route: true },
            { label: 'Blog', to: '/blog', route: true },
        ];

    return (
        <nav className="navbar">
            <div className="container">
                <div className="nav-brand">
                    <Link to="/" onClick={close}><h2>CRONZPH</h2></Link>
                </div>

                <div className="nav-links" id="navLinks" style={open ? { maxHeight: '400px', padding: '1rem 0' } : {}}>
                    {navItems.map(item =>
                        item.route ? (
                            <NavLink key={item.label} to={item.to} className="nav-link" onClick={close}>
                                {item.label}
                            </NavLink>
                        ) : (
                            <a key={item.label} href={item.to} className="nav-link" onClick={close}>
                                {item.label}
                            </a>
                        )
                    )}
                </div>

                <button className="theme-toggle" onClick={onToggleTheme} title="Toggle theme">
                    <span className="sun">☀️</span>
                    <span className="moon">🌙</span>
                </button>

                <button
                    className={`mobile-menu-toggle${open ? ' active' : ''}`}
                    onClick={() => setOpen(o => !o)}
                    aria-label="Toggle menu"
                >
                    <span className="hamburger" />
                    <span className="hamburger" />
                    <span className="hamburger" />
                </button>
            </div>
        </nav>
    );
}

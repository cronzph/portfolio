import { useRef, useState, useEffect } from 'react';

const PLATFORM_LABELS = { youtube: 'YouTube', tiktok: 'TikTok', facebook: 'Facebook', instagram: 'Instagram' };

/**
 * Lazy-loading video embed — only renders iframe when scrolled into view.
 * ponytail: Facebook embeds are blocked by FB for most share/reel links — show a link button instead.
 */
export default function VideoEmbed({ embed, originalUrl }) {
    const ref = useRef(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
            { rootMargin: '200px' }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, []);

    // Facebook blocks most iframe embeds; TikTok short links can't be resolved client-side
    // — render a styled link button for both
    const LINK_BUTTON = {
        facebook: { bg: '#1877f2', icon: 'f', label: 'Watch on Facebook' },
        tiktok: { bg: '#010101', icon: '♪', label: 'Watch on TikTok' },
    };
    if (embed.platform === 'facebook' || !embed.embedUrl) {
        const cfg = LINK_BUTTON[embed.platform] || { bg: 'var(--accent-primary)', icon: '▶', label: `Watch on ${embed.platform}` };
        return (
            <div style={{ margin: '1.5rem 0' }}>
                <a
                    href={originalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
                        padding: '0.75rem 1.25rem',
                        background: cfg.bg,
                        color: '#fff',
                        borderRadius: '10px',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        textDecoration: 'none',
                        transition: 'opacity 0.2s',
                    }}
                    onMouseOver={e => e.currentTarget.style.opacity = '0.85'}
                    onMouseOut={e => e.currentTarget.style.opacity = '1'}
                >
                    <span style={{ fontSize: '1.1rem', fontWeight: 900 }}>{cfg.icon}</span>
                    {cfg.label}
                </a>
            </div>
        );
    }

    const isVertical = embed.aspectRatio === '9/16';

    return (
        <div
            ref={ref}
            className="video-embed"
            style={{
                width: '100%',
                maxWidth: isVertical ? '360px' : '100%',
                margin: '1.5rem auto',
                aspectRatio: embed.aspectRatio,
                borderRadius: '12px',
                overflow: 'hidden',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
            }}
        >
            {visible ? (
                <iframe
                    src={embed.embedUrl}
                    title={`${embed.platform} video`}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                />
            ) : (
                <div style={{
                    width: '100%', height: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-muted)', fontSize: '0.9rem',
                }}>
                    <a href={originalUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }}>
                        ▶ Loading {PLATFORM_LABELS[embed.platform] || embed.platform} video…
                    </a>
                </div>
            )}
        </div>
    );
}

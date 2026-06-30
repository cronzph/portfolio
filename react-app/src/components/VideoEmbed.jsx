import { useRef, useState, useEffect } from 'react';

/**
 * Lazy-loading video embed — only renders iframe when scrolled into view.
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
                        ▶ Loading {embed.platform} video…
                    </a>
                </div>
            )}
        </div>
    );
}

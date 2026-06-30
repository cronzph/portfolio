import { useEffect, useState } from 'react';
import { CAT_COLORS } from '../constants';
import { ref, push } from 'firebase/database';
import { db } from '../firebase';
import ContentRenderer from './ContentRenderer';

function getPostCategories(post) {
    if (Array.isArray(post.categories) && post.categories.length > 0) return post.categories;
    if (post.category) return [post.category];
    return [];
}

function trackView(postId, page = 'portfolio') {
    push(ref(db, `views/${postId}`), { postId, timestamp: Date.now(), page }).catch(() => { });
}

export default function PostModal({ post, onClose }) {
    const [lightbox, setLightbox] = useState(null);

    useEffect(() => {
        if (!post) return;
        trackView(post.id);
        document.body.style.overflow = 'hidden';
        const onKey = e => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = '';
            window.removeEventListener('keydown', onKey);
        };
    }, [post, onClose]);

    if (!post) return null;

    const cats = getPostCategories(post);
    const date = new Date(post.createdAt).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
    });

    return (
        <>
            <div className="post-view-modal active">
                <div className="modal-overlay" onClick={onClose} />
                <div className="modal-container">
                    <button className="modal-close" onClick={onClose}>&times;</button>
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>{post.title}</h2>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.4rem' }}>
                                {cats.map(c => (
                                    <span key={c} style={{
                                        display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '99px',
                                        fontSize: '0.75rem', fontWeight: 600,
                                        background: `${CAT_COLORS[c] || '#94a3b8'}22`,
                                        color: CAT_COLORS[c] || '#94a3b8',
                                        border: `1px solid ${CAT_COLORS[c] || '#94a3b8'}44`,
                                    }}>{c}</span>
                                ))}
                            </div>
                        </div>

                        {post.bannerImage && (
                            <div className="modal-banner">
                                <img src={post.bannerImage.data} alt={post.title} />
                            </div>
                        )}

                        <div className="modal-body">
                            <ContentRenderer content={post.content || post.description} />
                            <div className="modal-meta"><span>📅 {date}</span></div>

                            {post.images?.length > 0 && (
                                <div className="modal-gallery">
                                    <h3>Gallery</h3>
                                    <div className="modal-gallery-grid">
                                        {post.images.map((img, i) => (
                                            <div key={i} className="modal-gallery-item" onClick={() => setLightbox(img.data)}>
                                                <img src={img.data} alt={`${post.title} – ${i + 1}`} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {lightbox && (
                <div
                    onClick={() => setLightbox(null)}
                    style={{
                        display: 'flex', position: 'fixed', inset: 0,
                        background: 'rgba(0,0,0,0.95)', zIndex: 10000,
                        alignItems: 'center', justifyContent: 'center', padding: '2rem',
                    }}
                >
                    <button
                        onClick={() => setLightbox(null)}
                        style={{
                            position: 'absolute', top: 20, right: 20,
                            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)',
                            color: 'white', fontSize: '2rem', width: 50, height: 50,
                            borderRadius: 8, cursor: 'pointer',
                        }}
                    >&times;</button>
                    <img
                        src={lightbox}
                        onClick={e => e.stopPropagation()}
                        style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', borderRadius: 8 }}
                        alt="Full size"
                    />
                </div>
            )}
        </>
    );
}

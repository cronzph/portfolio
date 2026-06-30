import { useState, useEffect, useMemo, useRef } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import PostModal from '../components/PostModal';
import { parseEmbedUrl } from '../utils/embedParser';

// ── Horizontal scroll row ─────────────────────────────────────────────────────
function CategoryRow({ label, posts, onSelect }) {
    const scrollRef = useRef(null);
    if (posts.length === 0) return null;

    return (
        <div className="blog-cat-row">
            <div className="blog-cat-row__header">
                <h3 className="blog-cat-row__title">#{label}</h3>
                <span className="blog-cat-row__count">{posts.length} post{posts.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="blog-cat-row__scroll" ref={scrollRef}>
                {posts.map(post => (
                    <BlogMiniCard key={post.id} post={post} onClick={() => onSelect(post)} />
                ))}
            </div>
        </div>
    );
}

// ── Mini card for horizontal rows ─────────────────────────────────────────────
function BlogMiniCard({ post, onClick }) {
    const imageUrl = post.coverImage || post.bannerImage?.data || post.images?.[0]?.data || null;
    const date = new Date(post.publishedAt || post.createdAt).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
    });

    // Check if content has a video embed for thumbnail fallback
    const firstEmbed = useMemo(() => {
        if (!post.content) return null;
        const lines = post.content.split('\n');
        for (const line of lines) {
            if (/^https?:\/\/\S+$/.test(line.trim())) {
                const e = parseEmbedUrl(line.trim());
                if (e) return e;
            }
        }
        return null;
    }, [post.content]);

    const thumbSrc = imageUrl || (firstEmbed?.platform === 'youtube'
        ? `https://img.youtube.com/vi/${firstEmbed.embedId}/hqdefault.jpg`
        : null);

    return (
        <div className="blog-mini-card" onClick={onClick}>
            <div className="blog-mini-card__thumb">
                {thumbSrc
                    ? <img src={thumbSrc} alt={post.title} loading="lazy" />
                    : <div className="blog-mini-card__placeholder">📝</div>
                }
            </div>
            <div className="blog-mini-card__body">
                <h4 className="blog-mini-card__title">{post.title}</h4>
                <p className="blog-mini-card__excerpt">
                    {(post.excerpt || post.description || '').slice(0, 80)}{(post.excerpt || post.description || '').length > 80 ? '…' : ''}
                </p>
                <span className="blog-mini-card__date">{date}</span>
            </div>
        </div>
    );
}

// ── Hero banner ───────────────────────────────────────────────────────────────
function HeroBanner({ post, catName, onSelect }) {
    if (!post) return null;

    const imageUrl = post.coverImage || post.bannerImage?.data || post.images?.[0]?.data || null;
    const tags = post.tags?.length ? post.tags : (catName ? [catName] : []);
    const date = new Date(post.publishedAt || post.createdAt).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
    });

    return (
        <div className="blog-hero" onClick={() => onSelect(post)}>
            <div className="blog-hero__image">
                {imageUrl
                    ? <img src={imageUrl} alt={post.title} loading="lazy" />
                    : <div className="blog-hero__placeholder">📰</div>
                }
                <div className="blog-hero__overlay" />
            </div>
            <div className="blog-hero__content">
                <div className="blog-hero__tags">
                    {tags.slice(0, 3).map(t => (
                        <span key={t} className="blog-hero__tag">#{t}</span>
                    ))}
                </div>
                <h1 className="blog-hero__title">{post.title}</h1>
                <p className="blog-hero__excerpt">
                    {(post.excerpt || post.description || '').slice(0, 200)}{(post.excerpt || post.description || '').length > 200 ? '…' : ''}
                </p>
                <div className="blog-hero__meta">
                    <span>📅 {date}</span>
                    {post.readTime && <span>⏱ {post.readTime} min read</span>}
                </div>
                <button className="blog-hero__cta">Read More →</button>
            </div>
        </div>
    );
}

// ── Blog page ─────────────────────────────────────────────────────────────────
export default function Blog() {
    const [posts, setPosts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);

    useEffect(() => {
        let postsLoaded = false, catsLoaded = false;
        const done = () => { if (postsLoaded && catsLoaded) setLoading(false); };

        const unsubPosts = onValue(ref(db, 'posts'), snap => {
            const arr = [];
            if (snap.exists()) {
                snap.forEach(c => {
                    const p = { id: c.key, ...c.val() };
                    if (p.blog === true || p.type === 'blog') arr.push(p);
                });
            }
            arr.sort((a, b) => (b.publishedAt || b.createdAt) - (a.publishedAt || a.createdAt));
            setPosts(arr);
            postsLoaded = true;
            done();
        });

        const unsubCats = onValue(ref(db, 'blogCategories'), snap => {
            const cats = [];
            if (snap.exists()) snap.forEach(c => cats.push({ id: c.key, ...c.val() }));
            setCategories(cats);
            catsLoaded = true;
            done();
        });

        return () => { unsubPosts(); unsubCats(); };
    }, []);

    // Featured post: only explicitly flagged `featured: true`
    const featured = useMemo(() => posts.find(p => p.featured === true) || null, [posts]);

    // Category name lookup map
    const catMap = useMemo(() => Object.fromEntries(categories.map(c => [c.id, c.name])), [categories]);

    // Group posts by blogCategory rows; uncategorized fall into #latest
    const taggedRows = useMemo(() => {
        const rows = [];
        for (const cat of categories) {
            const matching = posts.filter(p => p.category === cat.id);
            if (matching.length > 0) rows.push({ label: cat.name, posts: matching });
        }
        const categorized = new Set(rows.flatMap(r => r.posts.map(p => p.id)));
        const uncategorized = posts.filter(p => !categorized.has(p.id));
        if (uncategorized.length > 0) rows.push({ label: 'latest', posts: uncategorized });
        return rows;
    }, [posts, categories]);

    return (
        <div className="blog-page" style={{ paddingTop: '80px', minHeight: '100vh' }}>
            <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>

                {/* Header badge */}
                <div className="blog-header">
                    <div className="blog-header__badge">// SYSTEM LOG</div>
                    <h1 className="section-title">Dev Blog</h1>
                    <p className="section-subtitle">
                        Field notes, build logs, and tech deep-dives from the grind.
                    </p>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '4rem' }}>
                        <div className="spinner" style={{ margin: '0 auto 1rem' }} />
                        <p style={{ color: 'var(--text-secondary)' }}>Loading posts…</p>
                    </div>
                ) : posts.length === 0 ? (
                    <div className="empty-state">
                        <h3>No blog posts yet</h3>
                        <p>Check back soon — content incoming.</p>
                    </div>
                ) : (
                    <>
                        {/* Hero banner */}
                        <HeroBanner post={featured} catName={featured ? catMap[featured.category] : null} onSelect={setModal} />

                        {/* Horizontal category rows */}
                        <div className="blog-rows">
                            {taggedRows.map(({ label, posts: rowPosts }) => (
                                <CategoryRow key={label} label={label} posts={rowPosts} onSelect={setModal} />
                            ))}
                        </div>
                    </>
                )}
            </div>

            <PostModal post={modal} onClose={() => setModal(null)} />
        </div>
    );
}

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import PostModal from '../components/PostModal';
import { CATEGORIES, CAT_COLORS } from '../constants';

function getPostCategories(post) {
    if (Array.isArray(post.categories) && post.categories.length > 0) return post.categories;
    if (post.category) return [post.category];
    return [];
}

function PostCard({ post, onClick }) {
    const cats = getPostCategories(post);
    const imageUrl = post.bannerImage?.data || post.images?.[0]?.data || null;
    const date = new Date(post.createdAt).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
    });

    return (
        <div className="post-card" onClick={onClick}>
            <div className="post-banner">
                {imageUrl
                    ? <img src={imageUrl} alt={post.title} loading="lazy" />
                    : <div className="no-image">No Image</div>
                }
            </div>
            <div className="post-content">
                <div className="post-categories" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {cats.map(c => (
                        <span key={c} className="post-category" style={{
                            background: `${CAT_COLORS[c] || '#94a3b8'}22`,
                            color: CAT_COLORS[c] || '#94a3b8',
                            border: `1px solid ${CAT_COLORS[c] || '#94a3b8'}44`,
                        }}>{c}</span>
                    ))}
                </div>
                <h3 className="post-title">{post.title}</h3>
                <p className="post-description">
                    {post.description?.slice(0, 120)}{post.description?.length > 120 ? '…' : ''}
                </p>
                <div className="post-meta">📅 {date}</div>
            </div>
        </div>
    );
}

export default function Projects() {
    const [posts, setPosts] = useState({});
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState('newest');
    const [searchParams, setSearchParams] = useSearchParams();
    const [cat, setCat] = useState(searchParams.get('cat') || '');

    useEffect(() => {
        const unsub = onValue(ref(db, 'posts'), snap => {
            const data = {};
            if (snap.exists()) snap.forEach(c => { data[c.key] = { id: c.key, ...c.val() }; });
            setPosts(data);
            setLoading(false);
        });
        return unsub;
    }, []);

    // Sync cat → URL
    useEffect(() => {
        if (cat) setSearchParams({ cat });
        else setSearchParams({});
    }, [cat, setSearchParams]);

    const filtered = useMemo(() => {
        let arr = Object.values(posts);
        if (search) arr = arr.filter(p =>
            p.title?.toLowerCase().includes(search.toLowerCase()) ||
            p.description?.toLowerCase().includes(search.toLowerCase())
        );
        if (cat) arr = arr.filter(p =>
            getPostCategories(p).some(c => c.toLowerCase() === cat.toLowerCase())
        );
        switch (sort) {
            case 'newest': arr.sort((a, b) => b.createdAt - a.createdAt); break;
            case 'oldest': arr.sort((a, b) => a.createdAt - b.createdAt); break;
            case 'title-asc': arr.sort((a, b) => a.title.localeCompare(b.title)); break;
            case 'title-desc': arr.sort((a, b) => b.title.localeCompare(a.title)); break;
        }
        return arr;
    }, [posts, search, cat, sort]);

    const clearFilters = () => { setSearch(''); setCat(''); setSort('newest'); };

    return (
        <div className="all-posts-page" style={{ paddingTop: '80px', minHeight: '100vh' }}>
            <div className="container" style={{ paddingTop: '3rem' }}>
                <h1 className="section-title">All Projects</h1>
                <p className="section-subtitle">Browse everything I've built</p>

                {/* Filters */}
                <div className="filters-bar" style={{
                    display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem', alignItems: 'center',
                }}>
                    <input
                        className="search-input"
                        type="text"
                        placeholder="Search projects…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ flex: '1 1 200px', padding: '0.75rem 1rem', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.95rem' }}
                    />
                    <select
                        value={cat}
                        onChange={e => setCat(e.target.value)}
                        style={{ padding: '0.75rem 1rem', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.95rem' }}
                    >
                        <option value="">All Categories</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select
                        value={sort}
                        onChange={e => setSort(e.target.value)}
                        style={{ padding: '0.75rem 1rem', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.95rem' }}
                    >
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                        <option value="title-asc">Title A–Z</option>
                        <option value="title-desc">Title Z–A</option>
                    </select>
                    <button onClick={clearFilters} className="btn btn-primary" style={{ padding: '0.75rem 1.25rem', fontSize: '0.9rem' }}>
                        Clear
                    </button>
                </div>

                <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                    {loading ? 'Loading…' : `${filtered.length} project${filtered.length !== 1 ? 's' : ''} found`}
                </p>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '4rem' }}>
                        <div className="spinner" style={{ margin: '0 auto 1rem' }} />
                        <p style={{ color: 'var(--text-secondary)' }}>Loading projects…</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="empty-state">
                        <h3>No projects found</h3>
                        <p>Try adjusting your search or filters.</p>
                    </div>
                ) : (
                    <div className="portfolio-grid">
                        {filtered.map(post => (
                            <PostCard key={post.id} post={post} onClick={() => setModal(post)} />
                        ))}
                    </div>
                )}
            </div>

            <PostModal post={modal} onClose={() => setModal(null)} />
        </div>
    );
}

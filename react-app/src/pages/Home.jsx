import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFirebasePosts } from '../hooks/useFirebasePosts';
import PostModal from '../components/PostModal';
import { CATEGORIES, CAT_COLORS, CAT_ICONS, ROLES, EMAILJS_SERVICE, EMAILJS_TEMPLATE, EMAILJS_PUBLIC } from '../constants';
import emailjs from '@emailjs/browser';

// ── Typing effect ──────────────────────────────────────────────────────────────
function useTyping(roles) {
    const [text, setText] = useState('');
    const state = useRef({ roleIndex: 0, charIndex: 0, deleting: false });

    useEffect(() => {
        let timer;
        function tick() {
            const { roleIndex, charIndex, deleting } = state.current;
            const role = roles[roleIndex];
            const next = deleting ? role.slice(0, charIndex - 1) : role.slice(0, charIndex + 1);
            setText(next);
            if (!deleting && next.length === role.length) {
                state.current.deleting = true;
                timer = setTimeout(tick, 2000);
            } else if (deleting && next.length === 0) {
                state.current.deleting = false;
                state.current.roleIndex = (roleIndex + 1) % roles.length;
                state.current.charIndex = 0;
                timer = setTimeout(tick, 100);
            } else {
                state.current.charIndex = deleting ? charIndex - 1 : charIndex + 1;
                timer = setTimeout(tick, deleting ? 50 : 100);
            }
        }
        timer = setTimeout(tick, 100);
        return () => clearTimeout(timer);
    }, [roles]);

    return text;
}

// ── Highlight card ─────────────────────────────────────────────────────────────
function HighlightCard({ cat, post, catCount, onView }) {
    const color = CAT_COLORS[cat] || '#94a3b8';
    const imageUrl = post ? (post.bannerImage?.data || post.images?.[0]?.data || null) : null;
    const noMsg = catCount > 0 ? 'No highlight project set for this category yet.' : 'No project added yet.';

    return (
        <div className="highlight-card" data-cat={cat} style={{ '--accent-color': color }}>
            {imageUrl
                ? <img className="highlight-thumb" src={imageUrl} alt={post.title} loading="lazy" />
                : <div className="highlight-thumb-placeholder">{CAT_ICONS[cat] || '📁'}</div>
            }
            <div className="highlight-body">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span className="highlight-category-label">{cat}</span>
                    <span style={{
                        fontSize: '0.68rem', fontWeight: 600, padding: '0.2rem 0.55rem', borderRadius: '99px',
                        background: `${color}22`, color, border: `1px solid ${color}44`, whiteSpace: 'nowrap',
                    }}>{catCount} project{catCount !== 1 ? 's' : ''}</span>
                </div>
                <p className="highlight-title">{post ? post.title : 'Coming Soon'}</p>
                <p className="highlight-desc">
                    {post ? (post.description?.slice(0, 100) + (post.description?.length > 100 ? '…' : '')) : noMsg}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                    {post && (
                        <button className="highlight-view-btn" onClick={() => onView(post)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
                            View Project →
                        </button>
                    )}
                    <Link to={`/projects?cat=${encodeURIComponent(cat)}`} className="highlight-view-btn" style={{ opacity: post ? 0.6 : 1 }}>
                        Browse All →
                    </Link>
                </div>
            </div>
        </div>
    );
}

// ── Contact form ───────────────────────────────────────────────────────────────
function ContactForm() {
    const formRef = useRef();
    const [status, setStatus] = useState(null); // null | 'sending' | 'ok' | 'err'

    useEffect(() => { emailjs.init(EMAILJS_PUBLIC); }, []);

    const handleSubmit = e => {
        e.preventDefault();
        setStatus('sending');
        emailjs.sendForm(EMAILJS_SERVICE, EMAILJS_TEMPLATE, formRef.current)
            .then(() => { setStatus('ok'); formRef.current.reset(); })
            .catch(() => setStatus('err'));
    };

    return (
        <form ref={formRef} onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="form-group">
                    <label htmlFor="from_name">Your Name</label>
                    <input type="text" id="from_name" name="from_name" placeholder="Juan dela Cruz" required />
                </div>
                <div className="form-group">
                    <label htmlFor="from_email">Your Email</label>
                    <input type="email" id="from_email" name="from_email" placeholder="juan@email.com" required />
                </div>
            </div>
            <div className="form-group">
                <label htmlFor="subject">Subject</label>
                <input type="text" id="subject" name="subject" placeholder="Project Inquiry" required />
            </div>
            <div className="form-group">
                <label htmlFor="message">Message</label>
                <textarea id="message" name="message" rows={6} placeholder="Tell me about your project..." required />
            </div>
            {status === 'ok' && <div className="form-message success">✅ Message sent! I'll get back to you soon.</div>}
            {status === 'err' && <div className="form-message error">❌ Something went wrong. Please try again.</div>}
            <button type="submit" className="submit-btn" disabled={status === 'sending'}>
                <span>{status === 'sending' ? 'Sending…' : 'Send Message 🚀'}</span>
            </button>
        </form>
    );
}

// ── Home page ──────────────────────────────────────────────────────────────────
export default function Home() {
    const { posts, highlights, loading } = useFirebasePosts();
    const [modal, setModal] = useState(null);
    const typingText = useTyping(ROLES);

    const postsArr = Object.values(posts);

    return (
        <>
            {/* Hero */}
            <section id="home" className="hero">
                <div className="container">
                    <div className="hero-content">
                        <div className="hero-text">
                            <h1>Hi, I'm Mark Icel</h1>
                            <div className="typing-container">
                                <span className="im-a">I'm a</span>
                                <span className="typing-text">{typingText}</span>
                            </div>
                            <p className="hero-description">
                                Passionate about creating innovative digital solutions and bringing ideas to life through code and design.
                            </p>
                            <a href="#portfolio" className="btn btn-primary">View My Work</a>
                        </div>
                        <div className="hero-image">
                            <img src="/me.jpg" alt="Profile Picture" fetchpriority="high" decoding="async" />
                        </div>
                    </div>
                </div>
            </section>

            {/* Project Highlights — hidden entirely if no posts */}
            {!loading && postsArr.length === 0 ? null : (
                <section id="portfolio" className="highlights-section">
                    <div className="container">
                        <h2 className="section-title">Project Highlights</h2>
                        <p className="section-subtitle">One featured project from each category</p>

                        {loading ? (
                            <div className="highlights-grid">
                                <div className="highlights-loading">
                                    <div className="spinner" />
                                    <p>Loading highlights…</p>
                                </div>
                            </div>
                        ) : (
                            <div className="highlights-grid">
                                {CATEGORIES.map(cat => {
                                    const postId = highlights[cat];
                                    const post = postId ? posts[postId] : null;
                                    const count = postsArr.filter(p => {
                                        const cats = Array.isArray(p.categories) ? p.categories : p.category ? [p.category] : [];
                                        return cats.some(c => c.toLowerCase() === cat.toLowerCase());
                                    }).length;
                                    // Hide categories with no projects at all
                                    if (count === 0) return null;
                                    return (
                                        <HighlightCard key={cat} cat={cat} post={post} catCount={count} onView={setModal} />
                                    );
                                })}
                            </div>
                        )}

                        <div className="view-all-container">
                            <Link to="/projects" className="btn btn-primary">View All Projects</Link>
                        </div>
                    </div>
                </section>
            )}

            {/* About */}
            <section id="about" className="about-section">
                <div className="container">
                    <h2 className="section-title">About Me</h2>
                    <div className="about-content">
                        <p>I'm a developer and hardware enthusiast who loves building real solutions — from writing clean, functional code to designing and assembling hardware systems. I enjoy turning ideas into working systems, whether that's a web app, an IoT device, or an automated software solution.</p>
                        <div className="skills">
                            {CATEGORIES.map(s => <span key={s} className="skill-tag">{s}</span>)}
                        </div>
                    </div>
                </div>
            </section>

            {/* Contact */}
            <section id="contact" className="contact-section">
                <div className="container">
                    <h2 className="section-title">Get In Touch</h2>
                    <p className="section-subtitle">Let's work together on your next project</p>
                    <div className="contact-form-container">
                        <ContactForm />
                    </div>
                </div>
            </section>

            <PostModal post={modal} onClose={() => setModal(null)} />
        </>
    );
}

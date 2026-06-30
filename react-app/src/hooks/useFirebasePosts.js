import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';

export function useFirebasePosts() {
    const [posts, setPosts] = useState({});
    const [highlights, setHighlights] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let postsLoaded = false, hlLoaded = false;

        const unsubPosts = onValue(ref(db, 'posts'), snap => {
            const data = {};
            if (snap.exists()) snap.forEach(c => { data[c.key] = { id: c.key, ...c.val() }; });
            setPosts(data);
            postsLoaded = true;
            if (hlLoaded) setLoading(false);
        }, err => { setError(err.message); setLoading(false); });

        const unsubHL = onValue(ref(db, 'highlights'), snap => {
            const data = {};
            if (snap.exists()) snap.forEach(c => {
                const d = c.val();
                if (d?.category && d?.postId) data[d.category] = d.postId;
            });
            setHighlights(data);
            hlLoaded = true;
            if (postsLoaded) setLoading(false);
        });

        return () => { unsubPosts(); unsubHL(); };
    }, []);

    return { posts, highlights, loading, error };
}

/**
 * parseEmbedUrl — detects video platform links and returns embed info.
 * Returns { platform, embedId, embedUrl, aspectRatio } or null.
 */
export function parseEmbedUrl(url) {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();

    // YouTube: watch, shorts, youtu.be
    const ytWatch = trimmed.match(/(?:youtube\.com\/watch\?.*v=)([\w-]{11})/);
    if (ytWatch) return { platform: 'youtube', embedId: ytWatch[1], embedUrl: `https://www.youtube.com/embed/${ytWatch[1]}`, aspectRatio: '16/9' };

    const ytShort = trimmed.match(/youtube\.com\/shorts\/([\w-]{11})/);
    if (ytShort) return { platform: 'youtube', embedId: ytShort[1], embedUrl: `https://www.youtube.com/embed/${ytShort[1]}`, aspectRatio: '9/16' };

    const ytBe = trimmed.match(/youtu\.be\/([\w-]{11})/);
    if (ytBe) return { platform: 'youtube', embedId: ytBe[1], embedUrl: `https://www.youtube.com/embed/${ytBe[1]}`, aspectRatio: '16/9' };

    // TikTok: @user/video/ID
    const tt = trimmed.match(/tiktok\.com\/@[\w.-]+\/video\/(\d+)/);
    if (tt) return { platform: 'tiktok', embedId: tt[1], embedUrl: `https://www.tiktok.com/embed/v2/${tt[1]}`, aspectRatio: '9/16' };

    // Facebook: reel, share/r, watch, fb.watch
    const fbReel = trimmed.match(/facebook\.com\/reel\/(\d+)/);
    if (fbReel) return { platform: 'facebook', embedId: fbReel[1], embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(trimmed)}&show_text=false`, aspectRatio: '9/16' };

    const fbShareR = trimmed.match(/facebook\.com\/share\/r\/([\w-]+)/);
    if (fbShareR) return { platform: 'facebook', embedId: fbShareR[1], embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(trimmed)}&show_text=false`, aspectRatio: '9/16' };

    const fbWatch = trimmed.match(/facebook\.com\/watch\/?\?v=(\d+)/);
    if (fbWatch) return { platform: 'facebook', embedId: fbWatch[1], embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(trimmed)}&show_text=false`, aspectRatio: '16/9' };

    const fbShort = trimmed.match(/fb\.watch\/([\w-]+)/);
    if (fbShort) return { platform: 'facebook', embedId: fbShort[1], embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(trimmed)}&show_text=false`, aspectRatio: '9/16' };

    // Instagram: reel, post
    const igReel = trimmed.match(/instagram\.com\/reel\/([\w-]+)/);
    if (igReel) return { platform: 'instagram', embedId: igReel[1], embedUrl: `https://www.instagram.com/reel/${igReel[1]}/embed`, aspectRatio: '9/16' };

    const igPost = trimmed.match(/instagram\.com\/p\/([\w-]+)/);
    if (igPost) return { platform: 'instagram', embedId: igPost[1], embedUrl: `https://www.instagram.com/p/${igPost[1]}/embed`, aspectRatio: '1/1' };

    return null;
}

/**
 * Scans text content line-by-line. Lines that are standalone URLs matching
 * a supported platform get replaced with embed data. Returns an array of
 * { type: 'text' | 'embed', content | embed } segments.
 */
export function parseContentWithEmbeds(content) {
    if (!content) return [{ type: 'text', content: '' }];

    const lines = content.split('\n');
    const segments = [];
    let textBuffer = [];

    for (const line of lines) {
        const trimmed = line.trim();
        // A standalone URL line (starts with http and nothing else on the line)
        if (/^https?:\/\/\S+$/.test(trimmed)) {
            const embed = parseEmbedUrl(trimmed);
            if (embed) {
                // Flush text buffer
                if (textBuffer.length > 0) {
                    segments.push({ type: 'text', content: textBuffer.join('\n') });
                    textBuffer = [];
                }
                segments.push({ type: 'embed', embed, originalUrl: trimmed });
                continue;
            }
        }
        textBuffer.push(line);
    }

    // Flush remaining text
    if (textBuffer.length > 0) {
        segments.push({ type: 'text', content: textBuffer.join('\n') });
    }

    return segments;
}

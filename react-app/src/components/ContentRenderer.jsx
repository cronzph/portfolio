import { parseContentWithEmbeds } from '../utils/embedParser';
import VideoEmbed from './VideoEmbed';

/**
 * Renders post content with auto-detected video embeds.
 * Plain text lines render as paragraphs; standalone video URLs render as embeds.
 */
export default function ContentRenderer({ content }) {
    if (!content) return null;

    const segments = parseContentWithEmbeds(content);

    return (
        <div className="content-rendered">
            {segments.map((seg, i) => {
                if (seg.type === 'embed') {
                    return <VideoEmbed key={i} embed={seg.embed} originalUrl={seg.originalUrl} />;
                }
                // Render text with line breaks preserved
                return (
                    <p key={i} style={{ whiteSpace: 'pre-line', lineHeight: 1.75, wordBreak: 'break-word', marginBottom: '1rem' }}>
                        {seg.content}
                    </p>
                );
            })}
        </div>
    );
}

import { parseContentWithEmbeds } from '../utils/embedParser';
import VideoEmbed from './VideoEmbed';

const isHTML = str => /<[a-z][\s\S]*>/i.test(str);

/**
 * Renders post content with auto-detected video embeds.
 * If content contains HTML tags, renders as HTML; otherwise plain text.
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
                if (isHTML(seg.content)) {
                    return (
                        <div key={i} dangerouslySetInnerHTML={{ __html: seg.content }} />
                    );
                }
                return (
                    <p key={i} style={{ whiteSpace: 'pre-line', lineHeight: 1.75, wordBreak: 'break-word', marginBottom: '1rem' }}>
                        {seg.content}
                    </p>
                );
            })}
        </div>
    );
}

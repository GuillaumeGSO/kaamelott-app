import type { Quote } from '../api/client';
import { CharacterBadge } from './CharacterBadge';
import { YouTubeClip } from './YouTubeClip';

interface QuoteCardProps {
  quote: Quote;
  liked: boolean;
  onToggleLike: () => void;
  loading: boolean;
}

export function QuoteCard({ quote, liked, onToggleLike, loading }: QuoteCardProps) {
  const details: [string, string | null | undefined][] = [
    ['Acteur', quote.actorName],
    ['Film', quote.film],
    ['Saison', quote.season],
    ['Épisode', quote.episode],
  ];

  return (
    <article className="quote-card" aria-busy={loading}>
      <blockquote className="quote-text">{quote.text}</blockquote>

      <div className="quote-author">
        <CharacterBadge name={quote.character} />
        <span className="quote-character">{quote.character}</span>
        <button
          className="like-button"
          onClick={onToggleLike}
          aria-pressed={liked}
          aria-label={liked ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        >
          <span aria-hidden="true">{liked ? '♥' : '♡'}</span> {quote.likes}
        </button>
      </div>

      <dl className="quote-details">
        {details
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>

      {quote.youtubeVideoId && (
        <YouTubeClip
          key={quote.quoteId}
          videoId={quote.youtubeVideoId}
          startSeconds={quote.youtubeStartSeconds ?? 0}
        />
      )}
    </article>
  );
}

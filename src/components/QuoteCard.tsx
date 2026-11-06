import type { Quote } from '../api/client';
import { CharacterBadge } from './CharacterBadge';
import { DiamondIcon, HeartIcon } from './Icons';
import { YouTubeClip } from './YouTubeClip';

interface QuoteCardProps {
  quote: Quote;
  likes: number;
  liked: boolean;
  onToggleLike: () => void;
  loading: boolean;
}

// Film quotes have no clip of their own: they show the film's trailer, taken only from the
// official Kaamelott channel (@KaamelottOfficiel), which has a teaser but no trailer for the first
// film. Kept here rather than in the quotes data: one entry per film.
const TRAILERS = [
  { film: /premier volet/i, videoId: 'RtvMQ6lcLzg', label: 'Voir le teaser' },
  { film: /deuxi[eè]me volet/i, videoId: 'zs7TXGSXQfE', label: 'Voir la bande-annonce' },
];

function trailerFor(film: string | null | undefined) {
  return film ? TRAILERS.find(trailer => trailer.film.test(film)) : undefined;
}

// "Livre V · Corvus corone". The film is only named when it isn't the series itself.
function episodeLine(quote: Quote): string {
  const film = quote.film && quote.film !== 'Kaamelott' ? quote.film : null;
  return [film, quote.season, quote.episode].filter(Boolean).join(' · ');
}

export function QuoteCard({ quote, likes, liked, onToggleLike, loading }: QuoteCardProps) {
  const episode = episodeLine(quote);
  const trailer = quote.youtubeVideoId ? undefined : trailerFor(quote.film);

  return (
    <article className="quote-card" aria-busy={loading}>
      <div className="quote-mark" aria-hidden="true">
        «
      </div>
      <blockquote className="quote-text">{quote.text}</blockquote>

      <div className="ornament" aria-hidden="true">
        <DiamondIcon />
      </div>

      <div className="quote-author">
        <CharacterBadge name={quote.character} />
        <div className="quote-who">
          <span className="quote-character">{quote.character}</span>
          {quote.actorName && <span className="quote-actor">{quote.actorName}</span>}
        </div>
        <button
          className="like-button"
          onClick={onToggleLike}
          aria-pressed={liked}
          aria-label={liked ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        >
          <HeartIcon filled={liked} /> {likes}
        </button>
      </div>

      {episode && <p className="quote-episode">{episode}</p>}

      {quote.youtubeVideoId && (
        <YouTubeClip
          key={quote.quoteId}
          videoId={quote.youtubeVideoId}
          startSeconds={quote.youtubeStartSeconds ?? 0}
        />
      )}
      {trailer && <YouTubeClip key={quote.quoteId} videoId={trailer.videoId} startSeconds={0} label={trailer.label} />}
    </article>
  );
}

import { useState } from 'react';
import { PlayIcon } from './Icons';

interface YouTubeClipProps {
  videoId: string;
  startSeconds: number;
  label?: string;
}

// YouTube serves a 120×90 grey placeholder (not an error) when a video has no thumbnail.
const PLACEHOLDER_WIDTH = 120;

// Shows the clip's thumbnail (an image from i.ytimg.com, no cookies) and loads the player only
// when the user taps it: keeps the page light on phones and avoids YouTube cookies before any
// interaction. The clips come from the official Kaamelott channel.
export function YouTubeClip({ videoId, startSeconds, label = "Voir l'extrait" }: YouTubeClipProps) {
  const [open, setOpen] = useState(false);
  const [noThumbnail, setNoThumbnail] = useState(false);

  if (!open) {
    if (noThumbnail) {
      return (
        <button className="clip-button" onClick={() => setOpen(true)}>
          <PlayIcon /> {label}
        </button>
      );
    }
    return (
      <button className="clip-thumbnail" onClick={() => setOpen(true)}>
        <img
          src={`https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/mqdefault.jpg`}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={e => e.currentTarget.naturalWidth <= PLACEHOLDER_WIDTH && setNoThumbnail(true)}
          onError={() => setNoThumbnail(true)}
        />
        <span className="clip-play">
          <PlayIcon /> {label}
        </span>
      </button>
    );
  }

  const params = new URLSearchParams({ start: String(startSeconds), autoplay: '1', playsinline: '1' });
  return (
    <div className="clip">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${params}`}
        title="Extrait vidéo de la citation"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

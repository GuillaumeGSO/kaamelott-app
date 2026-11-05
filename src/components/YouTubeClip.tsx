import { useState } from 'react';

interface YouTubeClipProps {
  videoId: string;
  startSeconds: number;
}

// Nothing is loaded from YouTube until the user asks for the clip: keeps the page light on
// phones and avoids YouTube cookies before any interaction.
export function YouTubeClip({ videoId, startSeconds }: YouTubeClipProps) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button className="clip-button" onClick={() => setOpen(true)}>
        ▶ Voir l'extrait
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

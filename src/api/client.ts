// Typed client for the Kaamelott quotes API (kaamelott-lambda).
// URLs are relative: in production CloudFront serves the API on the same origin and adds
// the x-api-key header; in development the Vite proxy does the same (see vite.config.ts).

export interface Quote {
  quoteId: string;
  character: string;
  text: string;
  actorName?: string | null;
  film?: string | null;
  season?: string | null;
  episode?: string | null;
  youtubeVideoId?: string | null;
  youtubeStartSeconds?: number | null;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch {
      // non-JSON error body (e.g. API Gateway "Forbidden"): keep the status message
    }
    throw new ApiError(response.status, message);
  }
  return response.json() as Promise<T>;
}

// The whole set (~1,000 quotes), loaded once: random picks and filters happen in the browser.
// CloudFront caches it, so most visits never reach the API.
export async function getAllQuotes(): Promise<Quote[]> {
  const body = await request<{ quotes: Quote[] }>('/quotes/all');
  return body.quotes;
}

// Like counts of every liked quote (cached a few minutes by CloudFront).
export async function getLikes(): Promise<Record<string, number>> {
  const body = await request<{ likes: Record<string, number> }>('/quotes/likes');
  return body.likes;
}

// The quotes liked by a pseudo: one call instead of a status check per quote.
export async function getFavorites(alias: string): Promise<string[]> {
  const body = await request<{ quoteIds: string[] }>(`/favorites?${new URLSearchParams({ alias })}`);
  return body.quoteIds;
}

export async function postFavorite(quoteId: string, alias: string, favorite: boolean): Promise<number> {
  const body = await request<{ likes: number }>('/favorites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quoteId, alias, favorite }),
  });
  return body.likes;
}

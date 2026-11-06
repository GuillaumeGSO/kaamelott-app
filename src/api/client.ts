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
  likes: number;
  youtubeVideoId?: string | null;
  youtubeStartSeconds?: number | null;
}

export interface CharacterCount {
  character: string;
  numberOfQuotes: number;
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

// A 404 from the quote endpoints means "nothing matches", not a failure.
async function quoteOrNull(path: string): Promise<Quote | null> {
  try {
    return await request<Quote>(path);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export function getCharacters(): Promise<CharacterCount[]> {
  return request<CharacterCount[]>('/characters');
}

export async function getRandomQuotes(batchSize: number): Promise<Quote[]> {
  const body = await request<{ quotes: Quote[] }>(`/quotes/random?batchSize=${batchSize}`);
  return body.quotes;
}

export function getQuoteByCharacter(character: string): Promise<Quote | null> {
  return quoteOrNull(`/quotes/by-character/${encodeURIComponent(character)}`);
}

export function getQuoteByFavorites(alias?: string, character?: string): Promise<Quote | null> {
  const params = new URLSearchParams();
  if (alias) params.set('alias', alias);
  if (character) params.set('character', character);
  const query = params.toString();
  return quoteOrNull(`/quotes/by-favorites${query ? `?${query}` : ''}`);
}

export async function getFavoriteStatus(quoteId: string, alias: string): Promise<boolean> {
  const params = new URLSearchParams({ quoteId, alias });
  const body = await request<{ liked: boolean }>(`/favorites/status?${params}`);
  return body.liked;
}

export async function postFavorite(quoteId: string, alias: string, favorite: boolean): Promise<number> {
  const body = await request<{ likes: number }>('/favorites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quoteId, alias, favorite }),
  });
  return body.likes;
}

import { describe, expect, test, vi } from 'vitest';
import {
  ApiError,
  getFavoriteStatus,
  getQuoteByCharacter,
  getQuoteByFavorites,
  getRandomQuotes,
  postFavorite,
} from './client';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const mockFetch = (response: Response) => vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

describe('api client', () => {
  test('getRandomQuotes requests a batch and unwraps the quotes', async () => {
    const fetchSpy = mockFetch(json(200, { quotes: [{ quoteId: 'q1' }] }));

    expect(await getRandomQuotes(20)).toEqual([{ quoteId: 'q1' }]);
    expect(fetchSpy).toHaveBeenCalledWith('/quotes/random?batchSize=20', undefined);
  });

  test('getQuoteByCharacter encodes the character name', async () => {
    const fetchSpy = mockFetch(json(200, { quoteId: 'q1' }));

    await getQuoteByCharacter('Anna de Tintagel');
    expect(fetchSpy).toHaveBeenCalledWith('/quotes/by-character/Anna%20de%20Tintagel', undefined);
  });

  test('quote lookups return null on 404', async () => {
    mockFetch(json(404, { error: 'Character not found' }));

    expect(await getQuoteByCharacter('Personne')).toBeNull();
  });

  test('getQuoteByFavorites only sends the parameters that are set', async () => {
    const fetchSpy = mockFetch(json(200, { quoteId: 'q1' }));

    await getQuoteByFavorites(undefined, 'Perceval');
    expect(fetchSpy).toHaveBeenCalledWith('/quotes/by-favorites?character=Perceval', undefined);

    fetchSpy.mockResolvedValue(json(200, { quoteId: 'q1' }));
    await getQuoteByFavorites();
    expect(fetchSpy).toHaveBeenLastCalledWith('/quotes/by-favorites', undefined);
  });

  test('getFavoriteStatus returns the liked flag', async () => {
    const fetchSpy = mockFetch(json(200, { quoteId: 'q1', alias: 'merlin', liked: true }));

    expect(await getFavoriteStatus('q1', 'merlin')).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith('/favorites/status?quoteId=q1&alias=merlin', undefined);
  });

  test('postFavorite sends the favorite and returns the like count', async () => {
    const fetchSpy = mockFetch(json(200, { quoteId: 'q1', alias: 'merlin', likes: 3 }));

    expect(await postFavorite('q1', 'merlin', true)).toBe(3);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('/favorites');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({ quoteId: 'q1', alias: 'merlin', favorite: true });
  });

  test('errors carry the status and the API error message', async () => {
    mockFetch(json(400, { error: 'alias must be at most 20 characters' }));

    await expect(getFavoriteStatus('q1', 'x'.repeat(30))).rejects.toMatchObject({
      status: 400,
      message: 'alias must be at most 20 characters',
    });
  });

  test('non-JSON errors (API Gateway Forbidden) still raise an ApiError', async () => {
    mockFetch(new Response('Forbidden', { status: 403 }));

    const error = await getRandomQuotes(20).catch(e => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(403);
  });
});

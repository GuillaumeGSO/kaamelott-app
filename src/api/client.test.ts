import { describe, expect, test, vi } from 'vitest';
import { ApiError, getAllQuotes, getFavorites, getLikes, postFavorite } from './client';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const mockFetch = (response: Response) => vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

describe('api client', () => {
  test('getAllQuotes unwraps the quotes', async () => {
    const fetchSpy = mockFetch(json(200, { quotes: [{ quoteId: 'q1' }] }));

    expect(await getAllQuotes()).toEqual([{ quoteId: 'q1' }]);
    expect(fetchSpy).toHaveBeenCalledWith('/quotes/all', undefined);
  });

  test('getLikes unwraps the counts', async () => {
    const fetchSpy = mockFetch(json(200, { likes: { q1: 2 } }));

    expect(await getLikes()).toEqual({ q1: 2 });
    expect(fetchSpy).toHaveBeenCalledWith('/quotes/likes', undefined);
  });

  test('getFavorites encodes the pseudo and returns the liked quote ids', async () => {
    const fetchSpy = mockFetch(json(200, { alias: 'Dame du Lac', quoteIds: ['q1', 'q2'] }));

    expect(await getFavorites('Dame du Lac')).toEqual(['q1', 'q2']);
    expect(fetchSpy).toHaveBeenCalledWith('/favorites?alias=Dame+du+Lac', undefined);
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

    await expect(getFavorites('x'.repeat(30))).rejects.toMatchObject({
      status: 400,
      message: 'alias must be at most 20 characters',
    });
  });

  test('non-JSON errors (API Gateway Forbidden) still raise an ApiError', async () => {
    mockFetch(new Response('Forbidden', { status: 403 }));

    const error = await getAllQuotes().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(403);
  });
});

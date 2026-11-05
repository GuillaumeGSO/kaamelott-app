import { describe, expect, test, vi } from 'vitest';
import type { Quote } from './api/client';
import { QuoteQueue } from './quoteQueue';

const quotes = (...ids: string[]) => ids.map(quoteId => ({ quoteId }) as Quote);

describe('QuoteQueue', () => {
  test('fetches a batch on first use and serves quotes in order', async () => {
    const fetchBatch = vi.fn().mockResolvedValue(quotes('a', 'b', 'c'));
    const queue = new QuoteQueue(fetchBatch, { batchSize: 3, refillAt: 0 });

    expect((await queue.next())?.quoteId).toBe('a');
    expect((await queue.next())?.quoteId).toBe('b');
    expect(fetchBatch).toHaveBeenCalledTimes(1);
    expect(fetchBatch).toHaveBeenCalledWith(3);
  });

  test('refills in the background once the buffer is low', async () => {
    const fetchBatch = vi.fn().mockResolvedValue([]).mockResolvedValueOnce(quotes('a', 'b', 'c')).mockResolvedValueOnce(quotes('d', 'e'));
    const queue = new QuoteQueue(fetchBatch, { batchSize: 3, refillAt: 1 });

    await queue.next(); // a, 2 left
    await queue.next(); // b, 1 left -> refill starts
    expect(fetchBatch).toHaveBeenCalledTimes(2);
    await vi.waitFor(() => expect(queue.size).toBe(3));
    expect((await queue.next())?.quoteId).toBe('c');
  });

  test('runs a single fetch for concurrent calls on an empty buffer', async () => {
    const fetchBatch = vi.fn().mockResolvedValue(quotes('a', 'b', 'c', 'd'));
    const queue = new QuoteQueue(fetchBatch, { batchSize: 4, refillAt: 0 });

    const [first, second] = await Promise.all([queue.next(), queue.next()]);
    expect([first?.quoteId, second?.quoteId]).toEqual(['a', 'b']);
    expect(fetchBatch).toHaveBeenCalledTimes(1);
  });

  test('skips quotes already waiting in the buffer', async () => {
    const fetchBatch = vi.fn().mockResolvedValue([]).mockResolvedValueOnce(quotes('a', 'b')).mockResolvedValueOnce(quotes('b', 'c'));
    const queue = new QuoteQueue(fetchBatch, { batchSize: 2, refillAt: 1 });

    await queue.next(); // a; b left -> refill brings b (duplicate) and c
    await vi.waitFor(() => expect(fetchBatch).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(queue.size).toBe(2));
    expect((await queue.next())?.quoteId).toBe('b');
    expect((await queue.next())?.quoteId).toBe('c');
  });

  test('returns null when the API has no quotes', async () => {
    const queue = new QuoteQueue(vi.fn().mockResolvedValue([]));

    expect(await queue.next()).toBeNull();
  });

  test('propagates a failed fetch and recovers on the next call', async () => {
    const fetchBatch = vi.fn().mockResolvedValue([]).mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(quotes('a'));
    const queue = new QuoteQueue(fetchBatch, { batchSize: 1, refillAt: 0 });

    await expect(queue.next()).rejects.toThrow('down');
    expect((await queue.next())?.quoteId).toBe('a');
  });
});

import type { Quote } from './api/client';

// Keeps a buffer of random quotes so "Encore une !" is instant. Refills in the background
// once the buffer gets low, and never runs two refills at the same time.
export class QuoteQueue {
  private readonly buffer: Quote[] = [];
  private refill: Promise<void> | null = null;
  private readonly fetchBatch: (size: number) => Promise<Quote[]>;
  private readonly batchSize: number;
  private readonly refillAt: number;

  constructor(
    fetchBatch: (size: number) => Promise<Quote[]>,
    { batchSize = 20, refillAt = 5 }: { batchSize?: number; refillAt?: number } = {},
  ) {
    this.fetchBatch = fetchBatch;
    this.batchSize = batchSize;
    this.refillAt = refillAt;
  }

  get size(): number {
    return this.buffer.length;
  }

  async next(): Promise<Quote | null> {
    if (this.buffer.length === 0) await this.startRefill();
    const quote = this.buffer.shift() ?? null;
    if (this.buffer.length <= this.refillAt) {
      // Background refill: a failure here is retried on the next call.
      this.startRefill().catch(() => {});
    }
    return quote;
  }

  private startRefill(): Promise<void> {
    this.refill ??= this.fetchBatch(this.batchSize)
      .then(quotes => {
        const known = new Set(this.buffer.map(q => q.quoteId));
        this.buffer.push(...quotes.filter(q => !known.has(q.quoteId)));
      })
      .finally(() => {
        this.refill = null;
      });
    return this.refill;
  }
}

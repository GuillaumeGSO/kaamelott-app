import { describe, expect, test } from 'vitest';
import type { Quote } from './api/client';
import { QuoteDeck } from './quoteDeck';

const quote = (quoteId: string, character = 'Perceval') => ({ quoteId, character }) as Quote;

// With random() close to 1, the shuffle swaps nothing: the deck keeps the input order.
const noShuffle = () => 0.9999;

describe('QuoteDeck', () => {
  test('deals every quote once before repeating', () => {
    const deck = new QuoteDeck([quote('a'), quote('b'), quote('c')]);

    const firstRound = [deck.next(), deck.next(), deck.next()].map(q => q?.quoteId);
    expect(firstRound.sort()).toEqual(['a', 'b', 'c']);
    expect(firstRound).toHaveLength(3);
  });

  test('shuffles with the given random source', () => {
    // random() = 0 swaps each position with the first: [a, b, c] → [b, c, a]
    const deck = new QuoteDeck([quote('a'), quote('b'), quote('c')], () => 0);

    expect([deck.next(), deck.next(), deck.next()].map(q => q?.quoteId)).toEqual(['b', 'c', 'a']);
  });

  test('deals only matching quotes, carrying on from the last one dealt', () => {
    const deck = new QuoteDeck(
      [quote('a', 'Arthur'), quote('p1'), quote('b', 'Arthur'), quote('p2')],
      noShuffle,
    );
    const arthur = (q: Quote) => q.character === 'Arthur';

    expect(deck.next()?.quoteId).toBe('a');
    expect(deck.next(arthur)?.quoteId).toBe('b');
    expect(deck.next()?.quoteId).toBe('p2');
    expect(deck.next(arthur)?.quoteId).toBe('a');
  });

  test('returns null when nothing matches', () => {
    const deck = new QuoteDeck([quote('a'), quote('b')]);

    expect(deck.next(() => false)).toBeNull();
    expect(new QuoteDeck([]).next()).toBeNull();
  });

  test('counts quotes per character', () => {
    const deck = new QuoteDeck([quote('a', 'Arthur'), quote('p1'), quote('p2')]);

    expect(deck.characters()).toEqual(
      expect.arrayContaining([
        { character: 'Arthur', numberOfQuotes: 1 },
        { character: 'Perceval', numberOfQuotes: 2 },
      ]),
    );
  });
});

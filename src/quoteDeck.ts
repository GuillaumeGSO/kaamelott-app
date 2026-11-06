import type { Quote } from './api/client';

export interface CharacterCount {
  character: string;
  numberOfQuotes: number;
}

// Deals quotes from the whole set, loaded once: every quote is shuffled once, then each draw
// walks on from the last one dealt to the next quote matching the current filters. No repeats
// until every matching quote has been seen, and changing a filter needs no new fetch.
export class QuoteDeck {
  private readonly order: Quote[];
  private position = 0;

  constructor(quotes: Quote[], random: () => number = Math.random) {
    this.order = [...quotes];
    // Fisher–Yates shuffle
    for (let i = this.order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [this.order[i], this.order[j]] = [this.order[j], this.order[i]];
    }
  }

  next(matches: (quote: Quote) => boolean = () => true): Quote | null {
    const count = this.order.length;
    for (let step = 0; step < count; step++) {
      const index = (this.position + step) % count;
      if (matches(this.order[index])) {
        this.position = (index + 1) % count;
        return this.order[index];
      }
    }
    return null;
  }

  characters(): CharacterCount[] {
    const counts = new Map<string, number>();
    for (const { character } of this.order) counts.set(character, (counts.get(character) ?? 0) + 1);
    return [...counts].map(([character, numberOfQuotes]) => ({ character, numberOfQuotes }));
  }
}

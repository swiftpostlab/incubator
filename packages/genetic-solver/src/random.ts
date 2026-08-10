import type { Rng } from './types.ts';

/**
 * mulberry32 — a small, fast, well-distributed 32-bit generator.
 *
 * `Math.random` is deliberately not used: a seeded generator makes a solver run
 * reproducible, which is the difference between a test that pins behaviour and
 * one that fails once a fortnight for no visible reason.
 *
 * The seed must be an integer. A fractional seed would be truncated, making
 * `1.2` and `1.9` produce the same stream, and a non-finite one would silently
 * fall back to `1` — both quietly destroy the reproducibility the seed exists
 * for, so they are rejected instead.
 */
export const createRng = (seed = 1): Rng => {
  if (!Number.isInteger(seed)) {
    throw new RangeError(`seed must be an integer, received ${String(seed)}`);
  }

  // Keep the state away from 0, which would make mulberry32 degenerate.
  let state = seed || 1;

  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let drawn = Math.imul(state ^ (state >>> 15), 1 | state);
    drawn = (drawn + Math.imul(drawn ^ (drawn >>> 7), 61 | drawn)) ^ drawn;
    return ((drawn ^ (drawn >>> 14)) >>> 0) / 4294967296;
  };

  const int = (maxExclusive: number): number => {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError(
        `int() needs a positive integer bound, received ${String(maxExclusive)}`,
      );
    }
    return Math.floor(next() * maxExclusive);
  };

  const pick = <TItem>(items: readonly TItem[]): TItem => {
    if (items.length === 0) {
      throw new RangeError('pick() needs a non-empty list');
    }
    return items[int(items.length)];
  };

  return { next, int, pick };
};

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createRng } from './random.ts';

describe('createRng', () => {
  test('is deterministic for a given seed', () => {
    const first = Array.from({ length: 20 }, () => createRng(42).next());
    const second = createRng(42);

    // Same seed, same sequence — replayed from a fresh generator each time.
    assert.deepEqual(first[0], second.next());
    assert.deepEqual(
      Array.from({ length: 20 }, () => createRng(42).next()),
      first,
    );
  });

  test('produces different sequences for different seeds', () => {
    const a = Array.from({ length: 10 }, (_unused, index) =>
      createRng(index + 1).next(),
    );
    assert.equal(new Set(a).size, a.length);
  });

  test('stays within [0, 1)', () => {
    const rng = createRng(7);

    for (let draw = 0; draw < 1000; draw += 1) {
      const value = rng.next();
      assert.ok(value >= 0 && value < 1, `drew ${String(value)}`);
    }
  });

  test('int() stays within bounds and covers them', () => {
    const rng = createRng(3);
    const seen = new Set<number>();

    for (let draw = 0; draw < 500; draw += 1) {
      const value = rng.int(5);
      assert.ok(Number.isInteger(value));
      assert.ok(value >= 0 && value < 5);
      seen.add(value);
    }

    assert.equal(
      seen.size,
      5,
      'every value in the domain should eventually appear',
    );
  });

  test('int() rejects a non-positive bound', () => {
    const rng = createRng();
    assert.throws(() => rng.int(0), RangeError);
    assert.throws(() => rng.int(-1), RangeError);
    assert.throws(() => rng.int(1.5), RangeError);
  });

  test('pick() rejects an empty list', () => {
    const rng = createRng();
    assert.throws(() => rng.pick([]), RangeError);
  });

  test('seed 0 does not collapse the generator', () => {
    const rng = createRng(0);
    const values = new Set(Array.from({ length: 50 }, () => rng.next()));
    assert.ok(values.size > 40, 'a degenerate state would repeat values');
  });
});

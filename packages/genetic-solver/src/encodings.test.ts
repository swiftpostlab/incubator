import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createAssignmentEncoding } from './encodings.ts';
import { createRng } from './random.ts';

describe('createAssignmentEncoding validation', () => {
  test('rejects an empty position list', () => {
    assert.throws(
      () => createAssignmentEncoding({ domainSizes: [] }),
      RangeError,
    );
  });

  test('rejects a non-positive or non-integer domain size', () => {
    assert.throws(
      () => createAssignmentEncoding({ domainSizes: [3, 0] }),
      RangeError,
    );
    assert.throws(
      () => createAssignmentEncoding({ domainSizes: [3, -1] }),
      RangeError,
    );
    assert.throws(
      () => createAssignmentEncoding({ domainSizes: [3, 1.5] }),
      RangeError,
    );
  });
});

describe('createAssignmentEncoding.create', () => {
  test('produces one value per position, each inside its own domain', () => {
    const domainSizes = [2, 5, 3];
    const encoding = createAssignmentEncoding({ domainSizes });
    const rng = createRng(11);

    for (let draw = 0; draw < 200; draw += 1) {
      const candidate = encoding.create(rng);
      assert.equal(candidate.length, domainSizes.length);

      candidate.forEach((value, index) => {
        assert.ok(Number.isInteger(value));
        assert.ok(
          value >= 0 && value < domainSizes[index],
          `position ${String(index)} out of domain`,
        );
      });
    }
  });

  test('honours allowedValues', () => {
    const encoding = createAssignmentEncoding({
      domainSizes: [10, 10],
      allowedValues: [[3, 7], [1]],
    });
    const rng = createRng(12);

    for (let draw = 0; draw < 200; draw += 1) {
      const candidate = encoding.create(rng);
      assert.ok([3, 7].includes(candidate[0]));
      assert.equal(candidate[1], 1);
    }
  });

  test('falls back to the full domain when a position has no allowedValues entry', () => {
    const encoding = createAssignmentEncoding({
      domainSizes: [4, 4],
      allowedValues: [[2], undefined],
    });
    const rng = createRng(13);
    const seenAtSecond = new Set<number>();

    for (let draw = 0; draw < 200; draw += 1) {
      const candidate = encoding.create(rng);
      assert.equal(candidate[0], 2);
      seenAtSecond.add(candidate[1]);
    }

    assert.equal(
      seenAtSecond.size,
      4,
      'unrestricted position should reach its whole domain',
    );
  });
});

describe('createAssignmentEncoding.mutate', () => {
  test('does not modify the input candidate', () => {
    const encoding = createAssignmentEncoding({ domainSizes: [5, 5, 5, 5] });
    const rng = createRng(14);
    const original = [0, 1, 2, 3];
    const snapshot = [...original];

    for (let draw = 0; draw < 100; draw += 1) {
      encoding.mutate(original, rng);
    }

    assert.deepEqual(
      original,
      snapshot,
      'mutate must return a copy, not edit in place',
    );
  });

  test('changes at least one position', () => {
    // Domain size 1 would make a redraw invisible, so use a real domain and
    // check that repeated mutation actually moves the candidate.
    const encoding = createAssignmentEncoding({ domainSizes: [4, 4, 4] });
    const rng = createRng(15);
    const start = [0, 0, 0];
    let everDiffered = false;

    for (let draw = 0; draw < 50; draw += 1) {
      if (
        encoding
          .mutate(start, rng)
          .some((value, index) => value !== start[index])
      ) {
        everDiffered = true;
        break;
      }
    }

    assert.ok(everDiffered, 'mutation should be able to move the candidate');
  });

  test('keeps mutated values inside allowedValues', () => {
    const encoding = createAssignmentEncoding({
      domainSizes: [10, 10],
      allowedValues: [[3, 7], [1]],
    });
    const rng = createRng(16);
    let candidate = [3, 1];

    for (let draw = 0; draw < 300; draw += 1) {
      candidate = [...encoding.mutate(candidate, rng)];
      assert.ok([3, 7].includes(candidate[0]));
      assert.equal(candidate[1], 1);
    }
  });

  test('mutationStrength controls how many positions move', () => {
    const wide = createAssignmentEncoding({
      domainSizes: Array.from({ length: 20 }, () => 10),
      mutationStrength: 10,
    });
    const narrow = createAssignmentEncoding({
      domainSizes: Array.from({ length: 20 }, () => 10),
      mutationStrength: 1,
    });
    const start = Array.from({ length: 20 }, () => 0);

    const changed = (
      encoding: ReturnType<typeof createAssignmentEncoding>,
      seed: number,
    ): number => {
      const rng = createRng(seed);
      let total = 0;

      for (let draw = 0; draw < 100; draw += 1) {
        total += encoding
          .mutate(start, rng)
          .filter((value) => value !== 0).length;
      }

      return total;
    };

    assert.ok(
      changed(wide, 17) > changed(narrow, 17),
      'a higher mutationStrength should move more positions',
    );
  });
});

describe('createAssignmentEncoding.crossover', () => {
  test('does not modify either parent', () => {
    const encoding = createAssignmentEncoding({ domainSizes: [5, 5, 5, 5] });
    const rng = createRng(18);
    const first = [0, 1, 2, 3];
    const second = [4, 4, 4, 4];
    const firstSnapshot = [...first];
    const secondSnapshot = [...second];

    for (let draw = 0; draw < 100; draw += 1) {
      encoding.crossover(first, second, rng);
    }

    assert.deepEqual(
      first,
      firstSnapshot,
      'crossover must not edit the first parent',
    );
    assert.deepEqual(
      second,
      secondSnapshot,
      'crossover must not edit the second parent',
    );
  });

  test('takes every position from one parent or the other', () => {
    const encoding = createAssignmentEncoding({ domainSizes: [9, 9, 9, 9, 9] });
    const rng = createRng(19);
    const first = [1, 1, 1, 1, 1];
    const second = [8, 8, 8, 8, 8];

    for (let draw = 0; draw < 200; draw += 1) {
      const child = encoding.crossover(first, second, rng);
      child.forEach((value, index) => {
        assert.ok(
          value === first[index] || value === second[index],
          `position ${String(index)} invented the value ${String(value)}`,
        );
      });
    }
  });

  test('mixes both parents rather than copying one', () => {
    const encoding = createAssignmentEncoding({
      domainSizes: [9, 9, 9, 9, 9, 9, 9, 9],
    });
    const rng = createRng(20);
    const first = [1, 1, 1, 1, 1, 1, 1, 1];
    const second = [8, 8, 8, 8, 8, 8, 8, 8];
    let sawMixture = false;

    for (let draw = 0; draw < 50; draw += 1) {
      const child = encoding.crossover(first, second, rng);
      if (child.includes(1) && child.includes(8)) {
        sawMixture = true;
        break;
      }
    }

    assert.ok(sawMixture, 'uniform crossover should combine both parents');
  });

  test('a child of two allowed parents stays allowed', () => {
    // This is what lets the meeting scenario seed the search inside the
    // feasible region: since each position is copied from one parent at the
    // same position, the child inherits that position's allowed value.
    const encoding = createAssignmentEncoding({
      domainSizes: [10, 10],
      allowedValues: [
        [3, 7],
        [1, 2],
      ],
    });
    const rng = createRng(21);
    const first = [3, 1];
    const second = [7, 2];

    for (let draw = 0; draw < 200; draw += 1) {
      const child = encoding.crossover(first, second, rng);
      assert.ok([3, 7].includes(child[0]));
      assert.ok([1, 2].includes(child[1]));
    }
  });
});

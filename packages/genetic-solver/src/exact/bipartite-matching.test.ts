import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { maximumBipartiteMatching } from './bipartite-matching.ts';
import type { Adjacency, MatchingResult } from './bipartite-matching.ts';

/** Checks the result is a legal matching, independently of how it was built. */
const assertWellFormed = (
  adjacency: Adjacency,
  rightCount: number,
  result: MatchingResult,
): void => {
  const used = new Set<number>();

  result.leftMatch.forEach((right, left) => {
    if (right === -1) {
      return;
    }

    assert.ok(
      adjacency[left].includes(right),
      `left ${String(left)} was matched to ${String(right)}, which it cannot take`,
    );
    assert.ok(!used.has(right), `right ${String(right)} was matched twice`);
    used.add(right);
    assert.equal(
      result.rightMatch[right],
      left,
      'leftMatch and rightMatch disagree',
    );
  });

  assert.equal(used.size, result.size, 'size does not match the pairs made');
  assert.equal(result.rightMatch.length, rightCount);
  assert.equal(result.complete, result.size === adjacency.length);
  assert.deepEqual(
    result.unmatched,
    result.leftMatch.flatMap((right, left) => (right === -1 ? [left] : [])),
  );
};

describe('maximumBipartiteMatching', () => {
  test('matches everyone when the graph allows it', () => {
    const adjacency = [
      [0, 1],
      [1, 2],
      [2, 0],
    ];
    const result = maximumBipartiteMatching(adjacency, 3);

    assert.equal(result.complete, true);
    assert.equal(result.size, 3);
    assert.deepEqual(result.unmatched, []);
    assert.equal(result.bottleneck, undefined);
    assertWellFormed(adjacency, 3, result);
  });

  test('handles an empty left side', () => {
    const result = maximumBipartiteMatching([], 4);

    assert.equal(result.size, 0);
    assert.equal(
      result.complete,
      true,
      'nothing to place is trivially complete',
    );
    assert.deepEqual(result.unmatched, []);
  });

  test('reaches the true maximum when a greedy pass would not', () => {
    // Taken in order, a greedy pass gives left 0 the only right that left 1 can
    // use, and stops at 1 pair. The correct answer is 2, which needs left 0 to
    // be moved out of the way.
    const adjacency = [[0, 1], [0]];
    const result = maximumBipartiteMatching(adjacency, 2);

    assert.equal(result.size, 2);
    assert.equal(result.complete, true);
    assertWellFormed(adjacency, 2, result);
  });

  test('follows an augmenting chain the whole way down', () => {
    // Left i can take right i or i+1, so the first pass gives each left its own
    // index and leaves the last right free. The final left can only take right
    // 0, so placing it requires shifting every single left up by one — one
    // augmenting path as long as the left side. This is the case the iterative
    // walk exists for; a recursive one would recurse once per link.
    const chain = 5000;
    const adjacency: number[][] = Array.from(
      { length: chain },
      (_unused, i) => [i, i + 1],
    );
    adjacency.push([0]);

    const result = maximumBipartiteMatching(adjacency, chain + 1);

    assert.equal(result.complete, true, 'every left node should be placed');
    assert.equal(result.size, chain + 1);
    assertWellFormed(adjacency, chain + 1, result);
  });

  test('reports the people it cannot place', () => {
    const adjacency = [[0], [0], [0]];
    const result = maximumBipartiteMatching(adjacency, 1);

    assert.equal(result.complete, false);
    assert.equal(result.size, 1);
    assert.equal(result.unmatched.length, 2);
    assertWellFormed(adjacency, 1, result);
  });

  test('the bottleneck is a genuine proof, not a guess', () => {
    // Three left nodes competing for two right nodes, plus an unrelated pair
    // that matches fine. The witness must name the crowded three and their two
    // slots, and leave the innocent pair out of it.
    const adjacency = [[0, 1], [0, 1], [0, 1], [2]];
    const result = maximumBipartiteMatching(adjacency, 3);

    assert.equal(result.complete, false);
    assert.ok(result.bottleneck);

    const { leftNodes, rightNodes } = result.bottleneck;

    assert.ok(
      leftNodes.length > rightNodes.length,
      'a witness must have more claimants than seats',
    );

    // The defining property: those left nodes can reach nothing outside the set.
    const reachable = new Set(leftNodes.flatMap((left) => adjacency[left]));
    for (const right of reachable) {
      assert.ok(
        rightNodes.includes(right),
        `right ${String(right)} is reachable but missing from the witness`,
      );
    }

    assert.ok(
      !leftNodes.includes(3),
      'the matched pair is not part of the problem',
    );
  });

  test('an unreachable right node simply goes unused', () => {
    const adjacency = [[0], [0]];
    const result = maximumBipartiteMatching(adjacency, 5);

    assert.equal(result.size, 1);
    assert.equal(result.complete, false);
    assertWellFormed(adjacency, 5, result);
  });

  test('rejects a bad right count or an out-of-range edge', () => {
    assert.throws(() => maximumBipartiteMatching([[0]], -1), RangeError);
    assert.throws(() => maximumBipartiteMatching([[0]], 1.5), RangeError);
    assert.throws(() => maximumBipartiteMatching([[3]], 2), /right node/);
    assert.throws(() => maximumBipartiteMatching([[-1]], 2), /right node/);
  });

  test('a left node with no options is reported, not crashed on', () => {
    const adjacency = [[0], []];
    const result = maximumBipartiteMatching(adjacency, 2);

    assert.equal(result.complete, false);
    assert.deepEqual(result.unmatched, [1]);
    assertWellFormed(adjacency, 2, result);
  });

  test('agrees with exhaustive search on small random graphs', () => {
    // The strongest available oracle: for graphs small enough to enumerate, try
    // every assignment and compare against the largest one found by brute force.
    const best = (adjacency: Adjacency, rightCount: number): number => {
      let found = 0;

      const walk = (left: number, used: number, placed: number): void => {
        if (placed + (adjacency.length - left) <= found) {
          return;
        }

        if (left === adjacency.length) {
          found = Math.max(found, placed);
          return;
        }

        walk(left + 1, used, placed);

        for (const right of adjacency[left]) {
          const bit = 1 << right;
          if ((used & bit) === 0) {
            walk(left + 1, used | bit, placed + 1);
          }
        }
      };

      walk(0, 0, 0);
      return Math.min(found, rightCount);
    };

    let state = 7;
    const rand = (): number => {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    };

    for (let trial = 0; trial < 400; trial += 1) {
      const leftCount = 1 + Math.floor(rand() * 6);
      const rightCount = 1 + Math.floor(rand() * 6);
      const density = rand();
      const adjacency = Array.from({ length: leftCount }, () => {
        const options: number[] = [];
        for (let right = 0; right < rightCount; right += 1) {
          if (rand() < density) {
            options.push(right);
          }
        }
        return options;
      });

      const result = maximumBipartiteMatching(adjacency, rightCount);
      assert.equal(
        result.size,
        best(adjacency, rightCount),
        `disagreed with brute force on ${JSON.stringify(adjacency)}`,
      );
      assertWellFormed(adjacency, rightCount, result);
    }
  });
});

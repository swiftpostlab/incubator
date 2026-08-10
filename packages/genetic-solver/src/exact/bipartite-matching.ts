/**
 * Maximum bipartite matching, by augmenting paths (Kuhn's algorithm).
 *
 * This is the exact counterpart to the genetic search. Where `solve` returns
 * "the best I found", this returns "the best that exists" — and when no complete
 * matching exists it can say so with a proof rather than an exhausted budget.
 *
 * It applies whenever the problem is "give each left item its own distinct right
 * item, drawn from a per-item allowed set". Scheduling one private meeting per
 * person is exactly that, which is why the meeting scenario has an exact solver
 * at all.
 */

/** Left nodes are array indices; each entry lists the right nodes it may take. */
export type Adjacency = readonly (readonly number[])[];

/**
 * A group that makes a complete matching impossible: `leftNodes` between them
 * can only reach `rightNodes`, and there are more of the former than the latter.
 *
 * This is a Hall's-theorem witness, and it is the useful part of a failure. "No
 * schedule exists" tells a caller nothing they can act on; "these six people can
 * only attend these five slots" tells them exactly what to renegotiate.
 */
export interface Bottleneck {
  readonly leftNodes: readonly number[];
  readonly rightNodes: readonly number[];
}

export interface MatchingResult {
  /** For each left node, its matched right node, or -1 when unmatched. */
  readonly leftMatch: readonly number[];
  /** For each right node, its matched left node, or -1 when unmatched. */
  readonly rightMatch: readonly number[];
  /** Number of matched pairs. Equals `adjacency.length` when complete. */
  readonly size: number;
  /** True when every left node got a distinct right node. */
  readonly complete: boolean;
  /** Left nodes that could not be matched. Empty when `complete`. */
  readonly unmatched: readonly number[];
  /** Present only when incomplete: why no complete matching exists. */
  readonly bottleneck?: Bottleneck;
}

/**
 * Grow the matching from one left node by finding an augmenting path.
 *
 * Iterative rather than recursive: an augmenting path can be as long as the left
 * side, and a few thousand people would put a recursive version at risk of
 * blowing the stack on input that is otherwise perfectly reasonable.
 */
const augment = (
  start: number,
  adjacency: Adjacency,
  leftMatch: number[],
  rightMatch: number[],
  seen: Uint8Array,
): boolean => {
  // For each left node on the current path, how far through its adjacency list
  // we have looked. This is what makes the walk resumable without recursion.
  const cursor = new Map<number, number>();
  const path: number[] = [start];

  while (path.length > 0) {
    const left = path[path.length - 1];
    const options = adjacency[left];
    let index = cursor.get(left) ?? 0;

    let advanced = false;

    while (index < options.length) {
      const right = options[index];
      index += 1;

      if (seen[right] === 1) {
        continue;
      }

      seen[right] = 1;
      cursor.set(left, index);

      const holder = rightMatch[right];

      if (holder === -1) {
        // Free right node: walk the path back, flipping every edge.
        let current = left;
        let target = right;

        for (;;) {
          const displaced = leftMatch[current];
          leftMatch[current] = target;
          rightMatch[target] = current;

          path.pop();

          if (path.length === 0) {
            return true;
          }

          current = path[path.length - 1];
          target = displaced;
        }
      }

      // Taken: try to rehouse its current holder, one level deeper.
      path.push(holder);
      advanced = true;
      break;
    }

    if (!advanced) {
      cursor.set(left, index);
      path.pop();
    }
  }

  return false;
};

/**
 * Everything reachable from an unmatched left node by alternating path.
 *
 * The left nodes found, together with the right nodes they can reach, are a
 * Hall violator: every one of those right nodes is already taken by a left node
 * in the same set, so the set is one seat short by construction.
 */
const findBottleneck = (
  start: number,
  adjacency: Adjacency,
  rightMatch: readonly number[],
): Bottleneck => {
  const leftSeen = new Set<number>([start]);
  const rightSeen = new Set<number>();
  const queue = [start];

  while (queue.length > 0) {
    const left = queue.shift();

    if (left === undefined) {
      break;
    }

    for (const right of adjacency[left]) {
      if (rightSeen.has(right)) {
        continue;
      }

      rightSeen.add(right);
      const holder = rightMatch[right];

      if (holder !== -1 && !leftSeen.has(holder)) {
        leftSeen.add(holder);
        queue.push(holder);
      }
    }
  }

  return {
    leftNodes: [...leftSeen].sort((a, b) => a - b),
    rightNodes: [...rightSeen].sort((a, b) => a - b),
  };
};

/**
 * Match as many left nodes as possible to distinct right nodes.
 *
 * The result is exact: `complete: true` is a schedule that provably works, and
 * `complete: false` is a proof that none exists, not a search that gave up.
 */
export const maximumBipartiteMatching = (
  adjacency: Adjacency,
  rightCount: number,
): MatchingResult => {
  if (!Number.isInteger(rightCount) || rightCount < 0) {
    throw new RangeError(
      `rightCount must be an integer >= 0, received ${String(rightCount)}`,
    );
  }

  adjacency.forEach((options, left) => {
    for (const right of options) {
      if (!Number.isInteger(right) || right < 0 || right >= rightCount) {
        throw new RangeError(
          `adjacency[${String(left)}] contains ${String(right)}, which is not a right node in [0, ${String(rightCount)})`,
        );
      }
    }
  });

  const leftMatch = new Array<number>(adjacency.length).fill(-1);
  const rightMatch = new Array<number>(rightCount).fill(-1);
  let size = 0;

  for (let left = 0; left < adjacency.length; left += 1) {
    const seen = new Uint8Array(rightCount);

    if (augment(left, adjacency, leftMatch, rightMatch, seen)) {
      size += 1;
    }
  }

  const unmatched = leftMatch.flatMap((right, left) =>
    right === -1 ? [left] : [],
  );

  if (unmatched.length === 0) {
    return {
      leftMatch,
      rightMatch,
      size,
      complete: true,
      unmatched,
    };
  }

  return {
    leftMatch,
    rightMatch,
    size,
    complete: false,
    unmatched,
    bottleneck: findBottleneck(unmatched[0], adjacency, rightMatch),
  };
};

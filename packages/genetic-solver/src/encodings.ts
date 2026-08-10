import type { Encoding, Rng } from './types.ts';

/**
 * An assignment candidate: one integer choice per slot-taking item.
 *
 * `assignment[i]` is the value chosen for item `i`, drawn from `[0, domainSizes[i])`.
 * This covers any "pick one option per thing" problem — meeting scheduling,
 * shift rostering, bin packing by index — which is most of what a constraint
 * solver gets pointed at.
 */
export type Assignment = readonly number[];

export interface AssignmentEncodingOptions {
  /** Number of choices available to each item, positionally. */
  readonly domainSizes: readonly number[];
  /**
   * Values each item is allowed to take. When omitted, an item may take any
   * value in its full domain. Used to seed the search inside the feasible
   * region rather than making it discover feasibility by luck.
   */
  readonly allowedValues?: readonly (readonly number[] | undefined)[];
  /** Expected number of mutated positions per mutation. Default 1. */
  readonly mutationStrength?: number;
}

const valuesFor = (
  index: number,
  options: AssignmentEncodingOptions,
): readonly number[] | undefined => options.allowedValues?.[index];

const drawValue = (
  index: number,
  options: AssignmentEncodingOptions,
  rng: Rng,
): number => {
  const allowed = valuesFor(index, options);
  if (allowed && allowed.length > 0) {
    return rng.pick(allowed);
  }
  return rng.int(options.domainSizes[index]);
};

/**
 * Encoding for fixed-length integer assignments.
 *
 * - `create` draws each position independently.
 * - `mutate` re-draws a small number of positions, so a child stays close to its
 *   parent; large jumps are what crossover is for.
 * - `crossover` is uniform — each position comes from either parent with equal
 *   probability. Uniform beats single-point here because positions are
 *   independent, so there is no locality for a cut point to preserve.
 */
export const createAssignmentEncoding = (
  options: AssignmentEncodingOptions,
): Encoding<Assignment> => {
  const { domainSizes } = options;

  if (domainSizes.length === 0) {
    throw new RangeError('An assignment encoding needs at least one position');
  }

  domainSizes.forEach((size, index) => {
    if (!Number.isInteger(size) || size <= 0) {
      throw new RangeError(
        `domainSizes[${String(index)}] must be a positive integer, received ${String(size)}`,
      );
    }
  });

  const mutationStrength = options.mutationStrength ?? 1;

  return {
    create: (rng) =>
      domainSizes.map((_size, index) => drawValue(index, options, rng)),

    mutate: (candidate, rng) => {
      const mutated = [...candidate];
      // At least one position always changes, so mutate() is never a no-op.
      const positions = Math.max(1, Math.round(mutationStrength));

      for (let step = 0; step < positions; step += 1) {
        const index = rng.int(domainSizes.length);
        mutated[index] = drawValue(index, options, rng);
      }

      return mutated;
    },

    crossover: (first, second, rng) =>
      domainSizes.map((_size, index) =>
        rng.next() < 0.5 ? first[index] : second[index],
      ),
  };
};

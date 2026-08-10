/**
 * Core vocabulary for the solver. Everything here is generic over `TCandidate`,
 * the shape a caller uses to represent one possible solution.
 */

/** Deterministic random source. Seeded, so a run can be replayed exactly. */
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, maxExclusive). Throws when `maxExclusive` is not positive. */
  int(maxExclusive: number): number;
  /** Uniform pick from a non-empty list. Throws when the list is empty. */
  pick<TItem>(items: readonly TItem[]): TItem;
}

/**
 * A constraint scores how badly a candidate breaks a rule.
 *
 * `evaluate` returns a **violation magnitude**: `0` means fully satisfied, and
 * larger means worse. Returning a magnitude rather than a boolean lets the
 * search see partial progress, which is what makes a genetic approach work — a
 * candidate breaking one rule must score better than one breaking five.
 */
export interface Constraint<TCandidate> {
  /** Stable identifier, used in the result breakdown. */
  readonly id: string;
  /**
   * `hard` constraints must reach zero for a candidate to count as feasible.
   * `soft` constraints express preferences and are traded off against each other.
   */
  readonly kind: ConstraintKind;
  /**
   * Multiplier applied to this constraint's violation. Finite and >= 0, where 0
   * disables the constraint. Defaults to 1.
   */
  readonly weight?: number;
  /** Returns the violation magnitude; must be finite and >= 0. */
  evaluate(candidate: TCandidate): number;
}

export const constraintKinds = ['hard', 'soft'] as const;
export type ConstraintKind = (typeof constraintKinds)[number];

/**
 * How candidates are created and recombined. This is the only place that knows
 * the concrete representation, which keeps the solver itself domain-agnostic.
 */
export interface Encoding<TCandidate> {
  /** Build one random candidate. */
  create(rng: Rng): TCandidate;
  /** Return a mutated copy. Must not modify the input. */
  mutate(candidate: TCandidate, rng: Rng): TCandidate;
  /** Combine two parents into a new candidate. Must not modify the inputs. */
  crossover(first: TCandidate, second: TCandidate, rng: Rng): TCandidate;
  /**
   * Return a small variation of the candidate, used by local search when
   * `localSearchSteps` is set. Must not modify the input. Defaults to `mutate`.
   *
   * This is where domain knowledge pays. `mutate` moves a random position, so a
   * generic hill climb spends most of its steps touching parts of the candidate
   * that were already fine. A `neighbour` that targets what is actually broken
   * turns local search from a lottery into a repair.
   */
  neighbour?(candidate: TCandidate, rng: Rng): TCandidate;
}

/** A problem is an encoding plus the rules a solution is judged against. */
export interface Problem<TCandidate> {
  readonly encoding: Encoding<TCandidate>;
  readonly constraints: readonly Constraint<TCandidate>[];
}

/** Per-constraint detail for one evaluated candidate. */
export interface ConstraintBreakdown {
  readonly id: string;
  readonly kind: ConstraintKind;
  readonly violation: number;
  /** `violation * weight` — what actually fed into the penalty. */
  readonly weighted: number;
}

/** A candidate together with its score. Lower `penalty` is better. */
export interface Evaluation<TCandidate> {
  readonly candidate: TCandidate;
  /** Combined score: hard violations dominate, soft violations break ties. */
  readonly penalty: number;
  /** Weighted sum of hard-constraint violations. Zero means feasible. */
  readonly hardViolation: number;
  /** Weighted sum of soft-constraint violations. */
  readonly softViolation: number;
  /** True when every hard constraint is satisfied. */
  readonly feasible: boolean;
  readonly breakdown: readonly ConstraintBreakdown[];
}

export const stopReasons = [
  'target-reached',
  'max-generations',
  'stalled',
] as const;
export type StopReason = (typeof stopReasons)[number];

export interface SolveResult<TCandidate> {
  readonly best: Evaluation<TCandidate>;
  readonly stopReason: StopReason;
  /** Generations actually run, not counting the initial population. */
  readonly generations: number;
  /** Total candidate evaluations performed. */
  readonly evaluations: number;
  /** Best penalty after each generation, including the initial population. */
  readonly history: readonly number[];
}

/**
 * Every option is range-checked by `solve`, which throws a `RangeError` naming
 * the offending one. Each doc comment below states the accepted range.
 */
export interface SolverOptions {
  /** Candidates per generation. Integer >= 2. Default 100. */
  readonly populationSize?: number;
  /**
   * Hard cap on generations. Integer >= 0, where 0 means "score the initial
   * population and stop". Default 500.
   */
  readonly maxGenerations?: number;
  /** Chance a child is mutated after selection. In [0, 1]. Default 0.2. */
  readonly mutationProbability?: number;
  /**
   * Chance two parents are combined rather than one being copied. In [0, 1].
   * Default 0.9.
   */
  readonly crossoverProbability?: number;
  /**
   * Best candidates carried into the next generation untouched. Integer in
   * [0, populationSize). Default 2.
   */
  readonly elitismCount?: number;
  /** Candidates entered in each selection tournament. Integer >= 1. Default 3. */
  readonly tournamentSize?: number;
  /**
   * Seed for the internal RNG. Any integer. Default 1. Same seed plus same
   * problem gives the same run.
   */
  readonly seed?: number;
  /**
   * Multiplier making a hard violation outweigh any realistic soft total.
   * Finite and > 0. Default 1000.
   */
  readonly hardPenaltyWeight?: number;
  /** Stop once the best penalty is at or below this. Finite and >= 0. Default 0. */
  readonly targetPenalty?: number;
  /**
   * Stop after this many generations with no improvement. Integer >= 1.
   * Default 100.
   */
  readonly stallGenerations?: number;
  /**
   * Hill-climbing steps applied to each new candidate. Integer >= 0, where 0
   * disables local search. Default 0.
   *
   * Plain crossover and mutation are good at finding the neighbourhood of a
   * solution and bad at closing the last few violations, which usually need two
   * coordinated changes at once. Local search covers exactly that endgame, at a
   * cost of up to this many extra evaluations per candidate.
   */
  readonly localSearchSteps?: number;
}

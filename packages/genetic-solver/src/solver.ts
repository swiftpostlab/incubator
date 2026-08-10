import { evaluateCandidate } from './constraints.ts';
import { createRng } from './random.ts';
import type {
  Evaluation,
  Problem,
  Rng,
  SolveResult,
  SolverOptions,
} from './types.ts';

interface ResolvedOptions {
  readonly populationSize: number;
  readonly maxGenerations: number;
  readonly mutationProbability: number;
  readonly crossoverProbability: number;
  readonly elitismCount: number;
  readonly tournamentSize: number;
  readonly seed: number;
  readonly hardPenaltyWeight: number;
  readonly targetPenalty: number;
  readonly stallGenerations: number;
}

const assertInteger = (name: string, value: number, minimum: number): void => {
  if (!Number.isInteger(value) || value < minimum) {
    throw new RangeError(
      `${name} must be an integer >= ${String(minimum)}, received ${String(value)}`,
    );
  }
};

const assertProbability = (name: string, value: number): void => {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(
      `${name} must be a number in [0, 1], received ${String(value)}`,
    );
  }
};

const assertFiniteAtLeast = (
  name: string,
  value: number,
  minimum: number,
): void => {
  if (!Number.isFinite(value) || value < minimum) {
    throw new RangeError(
      `${name} must be a finite number >= ${String(minimum)}, received ${String(value)}`,
    );
  }
};

/**
 * Every option is checked, not just the ones with obvious failure modes.
 *
 * An out-of-range option does not crash the search — it degenerates it quietly.
 * A negative `maxGenerations` returns the initial population as though the
 * budget ran out; a `stallGenerations` of 0 stops after one generation even when
 * that generation improved; a `hardPenaltyWeight` of 0 makes hard constraints
 * invisible to selection while still reporting `feasible: false`. Each of those
 * looks like a solver that cannot solve the problem rather than like a caller
 * mistake, so they are rejected at the door.
 *
 * `seed` is the one exception: it is validated by `createRng`, which is the
 * single place that consumes it and is also reachable directly.
 */
const resolveOptions = (options: SolverOptions): ResolvedOptions => {
  const populationSize = options.populationSize ?? 100;
  assertInteger('populationSize', populationSize, 2);

  const elitismCount = options.elitismCount ?? 2;

  if (
    !Number.isInteger(elitismCount) ||
    elitismCount < 0 ||
    elitismCount >= populationSize
  ) {
    throw new RangeError(
      `elitismCount must be an integer in [0, populationSize), received ${String(elitismCount)}`,
    );
  }

  const tournamentSize = options.tournamentSize ?? 3;
  assertInteger('tournamentSize', tournamentSize, 1);

  // Zero is allowed: it means "score the initial population and stop", which is
  // a coherent request rather than a mistake.
  const maxGenerations = options.maxGenerations ?? 500;
  assertInteger('maxGenerations', maxGenerations, 0);

  const mutationProbability = options.mutationProbability ?? 0.2;
  assertProbability('mutationProbability', mutationProbability);

  const crossoverProbability = options.crossoverProbability ?? 0.9;
  assertProbability('crossoverProbability', crossoverProbability);

  // Strictly positive: at 0 a hard violation adds nothing to the penalty, so the
  // search would optimise soft preferences while ignoring feasibility. A caller
  // who wants that should declare those constraints soft.
  const hardPenaltyWeight = options.hardPenaltyWeight ?? 1000;

  if (!Number.isFinite(hardPenaltyWeight) || hardPenaltyWeight <= 0) {
    throw new RangeError(
      `hardPenaltyWeight must be a finite number > 0, received ${String(hardPenaltyWeight)}`,
    );
  }

  const targetPenalty = options.targetPenalty ?? 0;
  assertFiniteAtLeast('targetPenalty', targetPenalty, 0);

  // At least 1: at 0 the stall check fires at the end of the first generation
  // even when that generation improved, because the counter is reset to 0 first.
  const stallGenerations = options.stallGenerations ?? 100;
  assertInteger('stallGenerations', stallGenerations, 1);

  return {
    populationSize,
    elitismCount,
    tournamentSize,
    maxGenerations,
    mutationProbability,
    crossoverProbability,
    hardPenaltyWeight,
    targetPenalty,
    stallGenerations,
    seed: options.seed ?? 1,
  };
};

/**
 * Tournament selection: sample `tournamentSize` candidates and keep the best.
 *
 * Chosen over fitness-proportionate selection because it needs no normalisation
 * of the penalty scale and its selection pressure is tunable with one integer.
 */
const selectParent = <TCandidate>(
  population: readonly Evaluation<TCandidate>[],
  tournamentSize: number,
  rng: Rng,
): Evaluation<TCandidate> => {
  let best = population[rng.int(population.length)];

  for (let entrant = 1; entrant < tournamentSize; entrant += 1) {
    const challenger = population[rng.int(population.length)];
    if (challenger.penalty < best.penalty) {
      best = challenger;
    }
  }

  return best;
};

const byPenaltyAscending = <TCandidate>(
  left: Evaluation<TCandidate>,
  right: Evaluation<TCandidate>,
): number => left.penalty - right.penalty;

/**
 * Run a genetic search over `problem` and return the best candidate found.
 *
 * The search is a generational GA with elitism: each generation keeps the top
 * `elitismCount` candidates verbatim and fills the rest by tournament selection,
 * crossover, and mutation. It stops on whichever comes first — the target
 * penalty, a stall, or the generation cap — and reports which in `stopReason`.
 *
 * This is a heuristic, not an exact solver. A `stopReason` of `max-generations`
 * or `stalled` with an infeasible `best` means no solution was found, **not**
 * that none exists.
 */
export const solve = <TCandidate>(
  problem: Problem<TCandidate>,
  options: SolverOptions = {},
): SolveResult<TCandidate> => {
  const resolved = resolveOptions(options);
  const rng = createRng(resolved.seed);
  const { encoding, constraints } = problem;

  let evaluations = 0;

  const evaluate = (candidate: TCandidate): Evaluation<TCandidate> => {
    evaluations += 1;
    return evaluateCandidate(
      candidate,
      constraints,
      resolved.hardPenaltyWeight,
    );
  };

  let population = Array.from({ length: resolved.populationSize }, () =>
    evaluate(encoding.create(rng)),
  ).sort(byPenaltyAscending);

  let best = population[0];
  const history: number[] = [best.penalty];
  let generationsSinceImprovement = 0;
  let generations = 0;
  let stopReason: SolveResult<TCandidate>['stopReason'] = 'max-generations';

  if (best.penalty <= resolved.targetPenalty) {
    return {
      best,
      stopReason: 'target-reached',
      generations,
      evaluations,
      history,
    };
  }

  while (generations < resolved.maxGenerations) {
    generations += 1;

    const nextPopulation: Evaluation<TCandidate>[] = population.slice(
      0,
      resolved.elitismCount,
    );

    while (nextPopulation.length < resolved.populationSize) {
      const first = selectParent(population, resolved.tournamentSize, rng);

      let child: TCandidate;
      if (rng.next() < resolved.crossoverProbability) {
        const second = selectParent(population, resolved.tournamentSize, rng);
        child = encoding.crossover(first.candidate, second.candidate, rng);
      } else {
        child = first.candidate;
      }

      if (rng.next() < resolved.mutationProbability) {
        child = encoding.mutate(child, rng);
      }

      nextPopulation.push(evaluate(child));
    }

    population = nextPopulation.sort(byPenaltyAscending);
    const generationBest = population[0];

    if (generationBest.penalty < best.penalty) {
      best = generationBest;
      generationsSinceImprovement = 0;
    } else {
      generationsSinceImprovement += 1;
    }

    history.push(best.penalty);

    if (best.penalty <= resolved.targetPenalty) {
      stopReason = 'target-reached';
      break;
    }

    if (generationsSinceImprovement >= resolved.stallGenerations) {
      stopReason = 'stalled';
      break;
    }
  }

  return { best, stopReason, generations, evaluations, history };
};

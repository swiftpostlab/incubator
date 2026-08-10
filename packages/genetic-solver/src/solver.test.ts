import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { hardConstraint, softConstraint } from './constraints.ts';
import { createAssignmentEncoding } from './encodings.ts';
import { solve } from './solver.ts';
import type { Assignment, Problem, SolverOptions } from './index.ts';

/** Every position must equal its own index — one exact optimum, easy to verify. */
const identityProblem = (length: number): Problem<Assignment> => ({
  encoding: createAssignmentEncoding({
    domainSizes: Array.from({ length }, () => length),
  }),
  constraints: [
    hardConstraint('identity', (assignment) =>
      assignment.reduce<number>(
        (wrong, value, index) => wrong + (value === index ? 0 : 1),
        0,
      ),
    ),
  ],
});

describe('solve', () => {
  test('finds the exact optimum of a small problem', () => {
    const result = solve(identityProblem(6), { seed: 1, populationSize: 120 });

    assert.equal(result.stopReason, 'target-reached');
    assert.equal(result.best.penalty, 0);
    assert.equal(result.best.feasible, true);
    assert.deepEqual([...result.best.candidate], [0, 1, 2, 3, 4, 5]);
  });

  test('is reproducible for a given seed', () => {
    const options = { seed: 99, populationSize: 30, maxGenerations: 25 };
    const first = solve(identityProblem(8), options);
    const second = solve(identityProblem(8), options);

    assert.deepEqual([...first.best.candidate], [...second.best.candidate]);
    assert.equal(first.best.penalty, second.best.penalty);
    assert.equal(first.generations, second.generations);
    assert.deepEqual([...first.history], [...second.history]);
  });

  test('different seeds explore differently', () => {
    const options = { populationSize: 20, maxGenerations: 3 };
    const a = solve(identityProblem(10), { ...options, seed: 1 });
    const b = solve(identityProblem(10), { ...options, seed: 2 });

    assert.notDeepEqual([...a.best.candidate], [...b.best.candidate]);
  });

  test('never lets the best score get worse', () => {
    const result = solve(identityProblem(10), {
      seed: 5,
      populationSize: 40,
      maxGenerations: 60,
    });

    for (let index = 1; index < result.history.length; index += 1) {
      assert.ok(
        result.history[index] <= result.history[index - 1],
        `history regressed at generation ${String(index)}`,
      );
    }
  });

  test('reports max-generations when it runs out of budget', () => {
    const result = solve(identityProblem(40), {
      seed: 3,
      populationSize: 10,
      maxGenerations: 2,
      stallGenerations: 1000,
    });

    assert.equal(result.stopReason, 'max-generations');
    assert.equal(result.generations, 2);
    assert.ok(
      result.best.penalty > 0,
      'this budget should not be enough to solve it',
    );
  });

  test('reports stalled when no improvement arrives', () => {
    const result = solve(identityProblem(30), {
      seed: 4,
      populationSize: 10,
      maxGenerations: 5000,
      mutationProbability: 0,
      crossoverProbability: 0,
      stallGenerations: 3,
    });

    assert.equal(result.stopReason, 'stalled');
  });

  test('returns immediately when the initial population already hits the target', () => {
    const problem: Problem<Assignment> = {
      encoding: createAssignmentEncoding({ domainSizes: [1, 1, 1] }),
      constraints: [hardConstraint('always-satisfied', () => 0)],
    };

    const result = solve(problem, { seed: 1, populationSize: 5 });

    assert.equal(result.stopReason, 'target-reached');
    assert.equal(result.generations, 0);
    assert.equal(result.evaluations, 5);
  });

  test('prefers a feasible candidate over a lower soft score', () => {
    // Position 0 must be 1 (hard). Soft rule pulls it to 0. Hard must win.
    const problem: Problem<Assignment> = {
      encoding: createAssignmentEncoding({ domainSizes: [2] }),
      constraints: [
        hardConstraint('must-be-one', (assignment) =>
          assignment[0] === 1 ? 0 : 1,
        ),
        softConstraint('prefer-zero', (assignment) => assignment[0], 5),
      ],
    };

    const result = solve(problem, {
      seed: 1,
      populationSize: 20,
      maxGenerations: 50,
    });

    assert.equal(result.best.feasible, true);
    assert.equal(result.best.candidate[0], 1);
  });

  test('counts every evaluation it performs', () => {
    const populationSize = 20;
    const result = solve(identityProblem(25), {
      seed: 8,
      populationSize,
      elitismCount: 2,
      maxGenerations: 4,
      stallGenerations: 1000,
    });

    // Initial population, then (populationSize - elitismCount) children per generation.
    const expected = populationSize + result.generations * (populationSize - 2);
    assert.equal(result.evaluations, expected);
  });

  test('rejects a constraint returning a negative or non-finite violation', () => {
    const negative: Problem<Assignment> = {
      encoding: createAssignmentEncoding({ domainSizes: [2] }),
      constraints: [hardConstraint('negative', () => -1)],
    };
    const notFinite: Problem<Assignment> = {
      encoding: createAssignmentEncoding({ domainSizes: [2] }),
      constraints: [hardConstraint('nan', () => Number.NaN)],
    };

    assert.throws(() => solve(negative, { populationSize: 4 }), RangeError);
    assert.throws(() => solve(notFinite, { populationSize: 4 }), RangeError);
  });
});

describe('local search', () => {
  test('is off by default, so it costs nothing unasked', () => {
    const populationSize = 20;
    const result = solve(identityProblem(25), {
      seed: 8,
      populationSize,
      elitismCount: 2,
      maxGenerations: 4,
      stallGenerations: 1000,
    });

    const expected = populationSize + result.generations * (populationSize - 2);
    assert.equal(result.evaluations, expected);
  });

  test('every hill-climbing step is counted as an evaluation', () => {
    // Local search is not free, and hiding its cost would make `evaluations`
    // useless for comparing a refined run against a plain one.
    const populationSize = 10;
    const localSearchSteps = 3;
    const result = solve(identityProblem(25), {
      seed: 8,
      populationSize,
      elitismCount: 2,
      maxGenerations: 4,
      stallGenerations: 1000,
      localSearchSteps,
    });

    const perCandidate = 1 + localSearchSteps;
    const expected =
      populationSize * perCandidate +
      result.generations * (populationSize - 2) * perCandidate;

    assert.equal(result.evaluations, expected);
  });

  test('falls back to mutate when the encoding defines no neighbour', () => {
    const encoding = createAssignmentEncoding({
      domainSizes: Array.from({ length: 8 }, () => 8),
    });
    assert.ok(
      !Object.hasOwn(encoding, 'neighbour'),
      'precondition: the plain assignment encoding defines no neighbour',
    );

    const refined = solve(
      { encoding, constraints: identityProblem(8).constraints },
      { seed: 4, populationSize: 30, maxGenerations: 40, localSearchSteps: 6 },
    );

    assert.ok(refined.best.penalty >= 0);
    assert.ok(
      refined.evaluations > 30,
      'local search should have run despite no custom neighbour',
    );
  });

  test('uses the encoding neighbour when one is defined', () => {
    let neighbourCalls = 0;
    const base = createAssignmentEncoding({
      domainSizes: Array.from({ length: 6 }, () => 6),
    });
    const encoding = {
      ...base,
      neighbour: (
        candidate: Assignment,
        rng: Parameters<typeof base.mutate>[1],
      ) => {
        neighbourCalls += 1;
        return base.mutate(candidate, rng);
      },
    };

    solve(
      { encoding, constraints: identityProblem(6).constraints },
      { seed: 4, populationSize: 10, maxGenerations: 3, localSearchSteps: 2 },
    );

    assert.ok(neighbourCalls > 0, 'the custom neighbour should have been used');
  });

  test('never returns a candidate worse than the one it started from', () => {
    // First-improvement climbing accepts only strict improvements, so a run
    // with local search can never score worse than its own unrefined start.
    const encoding = createAssignmentEncoding({
      domainSizes: Array.from({ length: 10 }, () => 10),
    });
    const problem = {
      encoding,
      constraints: identityProblem(10).constraints,
    };

    const plain = solve(problem, {
      seed: 6,
      populationSize: 30,
      maxGenerations: 20,
    });
    const refined = solve(problem, {
      seed: 6,
      populationSize: 30,
      maxGenerations: 20,
      localSearchSteps: 10,
    });

    assert.ok(
      refined.best.penalty <= plain.best.penalty,
      `refined ${String(refined.best.penalty)} should not be worse than plain ${String(plain.best.penalty)}`,
    );

    for (let index = 1; index < refined.history.length; index += 1) {
      assert.ok(
        refined.history[index] <= refined.history[index - 1],
        'the best penalty must still never regress',
      );
    }
  });
});

describe('initialCandidates', () => {
  test('a seeded optimum is found without any searching', () => {
    const result = solve(identityProblem(12), {
      seed: 1,
      populationSize: 20,
      initialCandidates: [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]],
    });

    assert.equal(result.stopReason, 'target-reached');
    assert.equal(result.generations, 0, 'the answer was already in the seed');
    assert.deepEqual(
      [...result.best.candidate],
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    );
  });

  test('seeds are scored like anything else, not trusted', () => {
    // A deliberately terrible seed must not survive on the strength of being a
    // seed. It gets one slot in the population and is then out-competed.
    const terrible = Array.from({ length: 10 }, () => 9);
    const result = solve(identityProblem(10), {
      seed: 1,
      populationSize: 30,
      maxGenerations: 40,
      initialCandidates: [terrible],
    });

    assert.ok(
      result.best.penalty < 9000,
      'a bad seed should not hold the search back',
    );
  });

  test('seeding still fills the rest of the population at random', () => {
    const populationSize = 12;
    const result = solve(identityProblem(10), {
      seed: 1,
      populationSize,
      maxGenerations: 0,
      initialCandidates: [Array.from({ length: 10 }, () => 0)],
    });

    assert.equal(
      result.evaluations,
      populationSize,
      'one seed plus eleven random candidates',
    );
  });

  test('rejects more seeds than the population can hold', () => {
    assert.throws(
      () =>
        solve(identityProblem(4), {
          populationSize: 4,
          initialCandidates: [
            [0, 0, 0, 0],
            [1, 1, 1, 1],
            [2, 2, 2, 2],
            [3, 3, 3, 3],
            [0, 1, 2, 3],
          ],
        }),
      /initialCandidates/,
    );
  });

  test('exactly filling the population is allowed', () => {
    assert.doesNotThrow(() =>
      solve(identityProblem(4), {
        populationSize: 4,
        maxGenerations: 1,
        initialCandidates: [
          [0, 0, 0, 0],
          [1, 1, 1, 1],
          [2, 2, 2, 2],
          [0, 1, 2, 3],
        ],
      }),
    );
  });
});

describe('solve option validation', () => {
  const problem = identityProblem(3);

  const withOption = (option: string, value: number): SolverOptions =>
    // The whole point is to feed values the type system would reject, so the
    // assertion is the test doing its job rather than a hole in the typing.
    ({ maxGenerations: 1, elitismCount: 0, [option]: value }) as SolverOptions;

  /** Every rejected value should throw a RangeError naming the option. */
  const rejects = (option: string, values: readonly number[]): void => {
    for (const value of values) {
      assert.throws(
        () => solve(problem, withOption(option, value)),
        (error: unknown) =>
          error instanceof RangeError && error.message.includes(option),
        `${option}: ${String(value)} should be rejected, naming the option`,
      );
    }
  };

  /** Every accepted value should get through validation without throwing. */
  const accepts = (option: string, values: readonly number[]): void => {
    for (const value of values) {
      assert.doesNotThrow(
        () => solve(problem, withOption(option, value)),
        `${option}: ${String(value)} should be accepted`,
      );
    }
  };

  test('populationSize must be an integer >= 2', () => {
    rejects('populationSize', [
      1,
      0,
      -5,
      2.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]);
    accepts('populationSize', [2, 3, 50]);
  });

  test('elitismCount must be an integer in [0, populationSize)', () => {
    assert.throws(
      () => solve(problem, { populationSize: 10, elitismCount: 10 }),
      /elitismCount/,
    );
    assert.throws(
      () => solve(problem, { populationSize: 10, elitismCount: -1 }),
      /elitismCount/,
    );
    assert.throws(
      () => solve(problem, { populationSize: 10, elitismCount: 1.5 }),
      /elitismCount/,
    );
    assert.doesNotThrow(() =>
      solve(problem, {
        populationSize: 10,
        elitismCount: 9,
        maxGenerations: 1,
      }),
    );
    assert.doesNotThrow(() =>
      solve(problem, {
        populationSize: 10,
        elitismCount: 0,
        maxGenerations: 1,
      }),
    );
  });

  test('tournamentSize must be an integer >= 1', () => {
    rejects('tournamentSize', [0, -1, 2.5, Number.NaN]);
    accepts('tournamentSize', [1, 3, 10]);
  });

  test('maxGenerations must be an integer >= 0', () => {
    rejects('maxGenerations', [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]);
    accepts('maxGenerations', [0, 1, 500]);
  });

  test('maxGenerations of 0 scores the initial population and stops', () => {
    // The reason 0 is accepted rather than rejected: it is a coherent request,
    // and it is what "no generations run" is supposed to mean. The problem is
    // wide enough that 8 random draws cannot stumble onto the optimum, which
    // would otherwise end the run as 'target-reached' instead.
    const result = solve(identityProblem(12), {
      maxGenerations: 0,
      populationSize: 8,
    });

    assert.equal(result.generations, 0);
    assert.equal(result.evaluations, 8);
    assert.equal(result.stopReason, 'max-generations');
    assert.equal(result.history.length, 1);
  });

  test('mutationProbability must be in [0, 1]', () => {
    rejects('mutationProbability', [
      -0.1,
      1.1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]);
    accepts('mutationProbability', [0, 0.5, 1]);
  });

  test('crossoverProbability must be in [0, 1]', () => {
    rejects('crossoverProbability', [
      -0.1,
      1.1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]);
    accepts('crossoverProbability', [0, 0.5, 1]);
  });

  test('hardPenaltyWeight must be a finite number > 0', () => {
    rejects('hardPenaltyWeight', [0, -1, Number.NaN, Number.POSITIVE_INFINITY]);
    accepts('hardPenaltyWeight', [0.5, 1, 1000, 1e9]);
  });

  test('targetPenalty must be a finite number >= 0', () => {
    rejects('targetPenalty', [-1, Number.NaN, Number.POSITIVE_INFINITY]);
    accepts('targetPenalty', [0, 0.5, 100]);
  });

  test('stallGenerations must be an integer >= 1', () => {
    // 0 is rejected because the counter resets to 0 on improvement, so a stall
    // limit of 0 would end the run after one generation even when it improved.
    rejects('stallGenerations', [0, -1, 2.5, Number.NaN]);
    accepts('stallGenerations', [1, 100]);
  });

  test('localSearchSteps must be an integer >= 0', () => {
    rejects('localSearchSteps', [
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]);
    accepts('localSearchSteps', [0, 1, 25]);
  });

  test('seed must be an integer', () => {
    rejects('seed', [1.5, Number.NaN, Number.POSITIVE_INFINITY]);
    accepts('seed', [0, 1, -7, 123456]);
  });

  test('a rejected option is refused before any evaluation runs', () => {
    let evaluated = 0;
    const counting: Problem<Assignment> = {
      encoding: createAssignmentEncoding({ domainSizes: [2] }),
      constraints: [
        hardConstraint('counts', () => {
          evaluated += 1;
          return 1;
        }),
      ],
    };

    assert.throws(() => solve(counting, { stallGenerations: 0 }), RangeError);
    assert.equal(
      evaluated,
      0,
      'validation should happen before the search starts',
    );
  });
});

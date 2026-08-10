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

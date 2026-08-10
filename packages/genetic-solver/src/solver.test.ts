import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { hardConstraint, softConstraint } from './constraints.ts';
import { createAssignmentEncoding } from './encodings.ts';
import { solve } from './solver.ts';
import type { Assignment, Problem } from './index.ts';

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

  test('rejects invalid options', () => {
    const problem = identityProblem(3);

    assert.throws(() => solve(problem, { populationSize: 1 }), RangeError);
    assert.throws(
      () => solve(problem, { elitismCount: 10, populationSize: 10 }),
      RangeError,
    );
    assert.throws(() => solve(problem, { tournamentSize: 0 }), RangeError);
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

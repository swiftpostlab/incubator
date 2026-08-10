import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  evaluateCandidate,
  hardConstraint,
  softConstraint,
  violatedConstraints,
} from './constraints.ts';
import type { Constraint } from './types.ts';

const constant = <TCandidate>(
  id: string,
  kind: 'hard' | 'soft',
  violation: number,
  weight = 1,
): Constraint<TCandidate> => ({ id, kind, weight, evaluate: () => violation });

describe('constraint builders', () => {
  test('hardConstraint and softConstraint set kind and default weight', () => {
    const hard = hardConstraint('h', () => 0);
    const soft = softConstraint('s', () => 0);

    assert.equal(hard.kind, 'hard');
    assert.equal(soft.kind, 'soft');
    assert.equal(hard.weight, 1);
    assert.equal(soft.weight, 1);
  });

  test('an explicit weight is preserved', () => {
    assert.equal(hardConstraint('h', () => 0, 4).weight, 4);
    assert.equal(softConstraint('s', () => 0, 0.25).weight, 0.25);
  });
});

describe('evaluateCandidate', () => {
  test('a candidate breaking nothing is feasible with zero penalty', () => {
    const result = evaluateCandidate(
      null,
      [constant('a', 'hard', 0), constant('b', 'soft', 0)],
      1000,
    );

    assert.equal(result.penalty, 0);
    assert.equal(result.hardViolation, 0);
    assert.equal(result.softViolation, 0);
    assert.equal(result.feasible, true);
  });

  test('applies weights and separates hard from soft', () => {
    const result = evaluateCandidate(
      null,
      [constant('hard-a', 'hard', 2, 3), constant('soft-a', 'soft', 5, 2)],
      1000,
    );

    assert.equal(result.hardViolation, 6);
    assert.equal(result.softViolation, 10);
    assert.equal(result.penalty, 6 * 1000 + 10);
    assert.equal(result.feasible, false);
  });

  test('treats a missing weight as 1', () => {
    const noWeight: Constraint<null> = {
      id: 'n',
      kind: 'soft',
      evaluate: () => 7,
    };
    assert.equal(evaluateCandidate(null, [noWeight], 1000).softViolation, 7);
  });

  test('any hard violation outranks every soft one', () => {
    const barelyInfeasible = evaluateCandidate(
      null,
      [constant('h', 'hard', 1)],
      1000,
    );
    const veryPoorButFeasible = evaluateCandidate(
      null,
      [constant('s', 'soft', 999)],
      1000,
    );

    assert.equal(barelyInfeasible.feasible, false);
    assert.equal(veryPoorButFeasible.feasible, true);
    assert.ok(
      veryPoorButFeasible.penalty < barelyInfeasible.penalty,
      'a feasible candidate must always rank ahead of an infeasible one',
    );
  });

  test('hardPenaltyWeight is the knob that guarantees that ordering', () => {
    // Documented caveat: set it too low for the soft scale in play and the
    // ordering inverts. This pins that the caveat is real, not theoretical.
    const infeasible = evaluateCandidate(null, [constant('h', 'hard', 1)], 10);
    const feasible = evaluateCandidate(null, [constant('s', 'soft', 999)], 10);

    assert.ok(feasible.penalty > infeasible.penalty);
  });

  test('records a breakdown entry per constraint', () => {
    const result = evaluateCandidate(
      null,
      [constant('a', 'hard', 2, 3), constant('b', 'soft', 1, 5)],
      1000,
    );

    assert.deepEqual(
      result.breakdown.map((entry) => ({ ...entry })),
      [
        { id: 'a', kind: 'hard', violation: 2, weighted: 6 },
        { id: 'b', kind: 'soft', violation: 1, weighted: 5 },
      ],
    );
  });

  test('an empty constraint list is trivially feasible', () => {
    const result = evaluateCandidate(null, [], 1000);

    assert.equal(result.penalty, 0);
    assert.equal(result.feasible, true);
    assert.equal(result.breakdown.length, 0);
  });

  test('rejects a negative or non-finite violation', () => {
    assert.throws(
      () => evaluateCandidate(null, [constant('neg', 'hard', -1)], 1000),
      RangeError,
    );
    assert.throws(
      () =>
        evaluateCandidate(null, [constant('nan', 'hard', Number.NaN)], 1000),
      RangeError,
    );
    assert.throws(
      () =>
        evaluateCandidate(
          null,
          [constant('inf', 'soft', Number.POSITIVE_INFINITY)],
          1000,
        ),
      RangeError,
    );
  });

  test('names the offending constraint in the error', () => {
    assert.throws(
      () =>
        evaluateCandidate(null, [constant('the-bad-one', 'hard', -3)], 1000),
      /the-bad-one/,
    );
  });
});

describe('violatedConstraints', () => {
  test('returns only violated constraints, worst weighted first', () => {
    const result = evaluateCandidate(
      null,
      [
        constant('small', 'soft', 1, 1),
        constant('satisfied', 'hard', 0),
        constant('big', 'soft', 2, 10),
        constant('medium', 'hard', 5, 1),
      ],
      1000,
    );

    assert.deepEqual(
      violatedConstraints(result).map((entry) => entry.id),
      ['big', 'medium', 'small'],
    );
  });

  test('returns nothing when everything is satisfied', () => {
    const result = evaluateCandidate(null, [constant('a', 'hard', 0)], 1000);
    assert.deepEqual(violatedConstraints(result), []);
  });

  test('does not disturb the original breakdown order', () => {
    const result = evaluateCandidate(
      null,
      [constant('first', 'soft', 1, 1), constant('second', 'soft', 9, 9)],
      1000,
    );

    violatedConstraints(result);

    assert.deepEqual(
      result.breakdown.map((entry) => entry.id),
      ['first', 'second'],
    );
  });
});

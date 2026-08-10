import type { Constraint, ConstraintBreakdown, Evaluation } from './types.ts';

/** Convenience builder for a hard constraint (must reach zero to be feasible). */
export const hardConstraint = <TCandidate>(
  id: string,
  evaluate: (candidate: TCandidate) => number,
  weight = 1,
): Constraint<TCandidate> => ({ id, kind: 'hard', weight, evaluate });

/** Convenience builder for a soft constraint (a preference, not a requirement). */
export const softConstraint = <TCandidate>(
  id: string,
  evaluate: (candidate: TCandidate) => number,
  weight = 1,
): Constraint<TCandidate> => ({ id, kind: 'soft', weight, evaluate });

/**
 * Score one candidate against every constraint.
 *
 * Hard violations are multiplied by `hardPenaltyWeight` so that any infeasible
 * candidate ranks below every feasible one. That keeps a single scalar penalty
 * usable for selection while still preserving the hard/soft distinction.
 */
export const evaluateCandidate = <TCandidate>(
  candidate: TCandidate,
  constraints: readonly Constraint<TCandidate>[],
  hardPenaltyWeight: number,
): Evaluation<TCandidate> => {
  const breakdown: ConstraintBreakdown[] = [];
  let hardViolation = 0;
  let softViolation = 0;

  for (const constraint of constraints) {
    const violation = constraint.evaluate(candidate);

    if (!Number.isFinite(violation) || violation < 0) {
      throw new RangeError(
        `Constraint '${constraint.id}' returned ${String(violation)}; expected a finite value >= 0`,
      );
    }

    const weight = constraint.weight ?? 1;

    // A negative weight would turn a violation into a reward, and a non-finite
    // one poisons the penalty with NaN — which does not throw, it just makes
    // every comparison in selection false and the search wander. Neither is
    // recoverable, so both are rejected here rather than at construction: a
    // `Constraint` is a plain object and need not come from the builders.
    if (!Number.isFinite(weight) || weight < 0) {
      throw new RangeError(
        `Constraint '${constraint.id}' has weight ${String(weight)}; expected a finite value >= 0`,
      );
    }

    const weighted = violation * weight;
    breakdown.push({
      id: constraint.id,
      kind: constraint.kind,
      violation,
      weighted,
    });

    if (constraint.kind === 'hard') {
      hardViolation += weighted;
    } else {
      softViolation += weighted;
    }
  }

  return {
    candidate,
    penalty: hardViolation * hardPenaltyWeight + softViolation,
    hardViolation,
    softViolation,
    feasible: hardViolation === 0,
    breakdown,
  };
};

/** Constraints that are still violated, worst first. Handy for explaining a result. */
export const violatedConstraints = <TCandidate>(
  evaluation: Evaluation<TCandidate>,
): readonly ConstraintBreakdown[] =>
  [...evaluation.breakdown]
    .filter((entry) => entry.violation > 0)
    .sort((left, right) => right.weighted - left.weighted);

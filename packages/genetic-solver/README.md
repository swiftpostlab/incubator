# @swiftpost/genetic-solver

A standalone genetic-algorithm constraint solver in TypeScript. Describe a problem as an encoding
plus a set of constraints, and the solver searches for an assignment that satisfies them.

No runtime dependencies. No framework coupling — it does not import React, Next, or MUI, and it runs
under plain Node.

## When this is the right tool

Genetic search suits problems where the space is too large to enumerate, a good-enough answer beats
no answer, and you can *score how wrong* a candidate is rather than only whether it is valid.

It is **not** an exact solver. A run that ends without a feasible result means none was found, not
that none exists. If you need a proof of optimality or infeasibility, use an exact method.

## Usage

```ts
import { createDailySlots, createMeetingProblem, describeSchedule, solve } from '@swiftpost/genetic-solver';

const slots = createDailySlots(['mon', 'tue', 'wed'], 3);

const spec = {
  slots,
  people: [
    { id: 'ana', availableSlotIds: ['mon#0', 'mon#1'] },
    { id: 'bo', availableSlotIds: ['mon#1', 'tue#0'] },
    { id: 'cai', availableSlotIds: ['tue#0', 'wed#2'] },
  ],
  preferences: { compactDaysWeight: 1 },
};

const result = solve(createMeetingProblem(spec), { seed: 1 });

if (result.best.feasible) {
  for (const { person, slot } of describeSchedule(spec, result.best.candidate).meetings) {
    console.log(`${person.id} -> ${slot.id}`);
  }
}
```

## Core concepts

| Piece | Role |
|-------|------|
| `Constraint` | Scores how badly a candidate breaks one rule. `0` means satisfied; larger is worse. |
| `Encoding` | Knows the candidate representation: how to create, mutate, and combine one. |
| `Problem` | An encoding plus its constraints. |
| `solve` | Runs the search and returns the best candidate with a breakdown. |

### Violation magnitudes, not booleans

`evaluate` returns *how much* a rule is broken, not whether it is. This is the design decision the
whole library rests on: a genetic search needs a gradient. If constraints only reported true/false,
a candidate breaking one rule would look identical to one breaking five, and selection would have
nothing to climb.

### Hard vs soft

`hard` constraints must reach zero for a candidate to be `feasible`. `soft` constraints are
preferences. The solver combines them into one scalar penalty, multiplying hard violations by
`hardPenaltyWeight` (default 1000) so any infeasible candidate ranks below every feasible one.

If your soft weights can realistically sum above that, raise `hardPenaltyWeight` — otherwise the
search may trade away feasibility to win on preferences.

### Determinism

The RNG is seeded (default `1`), so the same problem plus the same options gives the same run. Vary
`seed` to sample different searches; a problem that solves on one seed and not another usually needs
a larger population, not a luckier seed.

## Options

| Option | Default | Range | Meaning |
|--------|---------|-------|---------|
| `populationSize` | 100 | integer >= 2 | Candidates per generation. |
| `maxGenerations` | 500 | integer >= 0 | Hard cap. `0` scores the initial population and stops. |
| `mutationProbability` | 0.2 | [0, 1] | Chance a child is mutated. |
| `crossoverProbability` | 0.9 | [0, 1] | Chance two parents are combined rather than one copied. |
| `elitismCount` | 2 | integer in [0, `populationSize`) | Best candidates carried over untouched. |
| `tournamentSize` | 3 | integer >= 1 | Selection pressure — higher converges faster and explores less. |
| `seed` | 1 | any integer | RNG seed. |
| `hardPenaltyWeight` | 1000 | finite > 0 | How much a hard violation outweighs soft ones. |
| `targetPenalty` | 0 | finite >= 0 | Stop once the best penalty reaches this. |
| `stallGenerations` | 100 | integer >= 1 | Stop after this many generations with no improvement. |

Every option is range-checked before the search starts; an out-of-range value throws a `RangeError`
naming the option. The strictness is deliberate — a bad option does not crash the solver, it
degenerates it quietly. A `stallGenerations` of `0` would end the run after one generation even when
that generation improved; a `hardPenaltyWeight` of `0` would make hard violations invisible to
selection while still reporting `feasible: false`; a fractional `seed` would be truncated, so `1.2`
and `1.9` would give the same run. Each of those looks like a solver that cannot solve your problem
rather than like a mistake in the call.

Constraint `weight` is checked the same way: finite and `>= 0`, where `0` disables the constraint. A
negative weight would turn a violation into a reward, and a `NaN` one would poison the penalty
without throwing — making every comparison in selection false and the search wander.

`solve` returns `stopReason` — `target-reached`, `stalled`, or `max-generations` — so you can tell a
solved problem from an exhausted budget.

## The scheduling scenario

`src/scenarios/meeting-scheduling.ts` is both a worked example and the library's main correctness
exercise. It models: a sequence of days offering slots, people available in only some of them, and a
need to give everyone a one-to-one meeting.

Constraints:

- `availability` (hard) — nobody is booked when unavailable.
- `no-double-booking` (hard) — no slot holds two meetings. Counts *surplus* bookings, so three people
  in one slot scores worse than two.
- `compact-days` (soft, opt-in) — pull meetings onto fewer days.
- `earliness` (soft, opt-in) — prefer earlier slots, normalised so the weight means the same thing
  regardless of schedule length.

People's available slots become the encoding's allowed values, which confines the whole search to the
availability-feasible region — not just the initial population. `create` and `mutate` only draw
allowed values, and uniform crossover copies each position from a parent at that same position, so
**no operator can produce an unavailable booking and `availability` always reads zero**.
`no-double-booking` is the only hard constraint the search actually has to work at.

`availability` is still declared rather than dropped, because it states the rule as data rather than
burying it in the encoding, and it stays correct for a caller who reuses these constraints with their
own unconfined encoding. Both properties are pinned by tests: one asserts the constraint never fires
during a real solve, the other asserts it does fire once the encoding is not confined.

Impossible inputs — someone with no availability, more people than slots, unknown slot ids, duplicate
ids — throw at construction rather than being left to the search, so you get a clear error instead of
an ambiguous "no solution found".

## Extending it

Define your own problem by supplying an `Encoding` and constraints:

```ts
import { createAssignmentEncoding, hardConstraint, softConstraint, solve } from '@swiftpost/genetic-solver';

const problem = {
  encoding: createAssignmentEncoding({ domainSizes: [4, 4, 4] }),
  constraints: [
    hardConstraint('all-different', (assignment) => assignment.length - new Set(assignment).size),
    softConstraint('prefer-low', (assignment) => assignment.reduce((sum, value) => sum + value, 0), 0.1),
  ],
};

const result = solve(problem, { seed: 1 });
```

`createAssignmentEncoding` covers any "pick one option per item" problem. For anything else, implement
`Encoding` directly — `create`, `mutate`, and `crossover` must return new values and never modify
their inputs.

## Commands

```sh
yarn workspace @swiftpost/genetic-solver test       # node:test, no test framework dependency
yarn workspace @swiftpost/genetic-solver lint
yarn workspace @swiftpost/genetic-solver typecheck
```

Tests run on Node's built-in runner with native TypeScript type stripping, which needs **Node 22.6+**
(the repo is on 24). That is why relative imports carry explicit `.ts` extensions — Node's ESM
resolver requires them.

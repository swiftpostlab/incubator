# @swiftpost/genetic-solver

Constraint solving in TypeScript, with two solvers that answer different questions. Describe a
problem as an encoding plus a set of constraints and `solve` searches for an assignment that
satisfies them; when the problem is "give each item its own distinct slot", `maximumBipartiteMatching`
answers it exactly instead of searching.

No runtime dependencies. No framework coupling — it does not import React, Next, or MUI, and it runs
under plain Node.

## Which solver you want

**Read this before reaching for the genetic search.** A heuristic is the wrong tool for a problem
that has an exact algorithm, and this library ships both so the choice is available.

| Your problem | Use |
|---|---|
| Each item needs its own distinct slot from a per-item allowed set, nothing else | `maximumBipartiteMatching` / `solveMeetingExactly` |
| The same, plus preferences to trade off | Exact first, then `solve` seeded with `initialCandidates` |
| Anything else — arbitrary constraints, no known exact algorithm | `solve` |

The difference is not academic. On a 1000-person schedule the genetic search ran for 56 seconds and
finished two bookings short; matching solved the same instance exactly in 5.5ms. Worse, that instance
*was* solvable — the search simply could not close the last conflicts, because doing so needs a chain
of relocations of unbounded length that no local move can reach.

Genetic search earns its place when the space is too large to enumerate, a good-enough answer beats
no answer, and you can *score how wrong* a candidate is rather than only whether it is valid. It is
**not** exact: a run ending without a feasible result means none was found, not that none exists.
Matching, by contrast, returns a proof either way.

## Usage

Exact, when the rules are only "everyone gets their own slot":

```ts
import { createDailySlots, describeSchedule, solveMeetingExactly } from '@swiftpost/genetic-solver';

const slots = createDailySlots(['mon', 'tue', 'wed'], 3);
const spec = {
  slots,
  people: [
    { id: 'ana', availableSlotIds: ['mon#0', 'mon#1'] },
    { id: 'bo', availableSlotIds: ['mon#1', 'tue#0'] },
    { id: 'cai', availableSlotIds: ['tue#0', 'wed#2'] },
  ],
};

const exact = solveMeetingExactly(spec);

if (exact.assignment) {
  for (const { person, slot } of describeSchedule(spec, exact.assignment).meetings) {
    console.log(`${person.id} -> ${slot.id}`);
  }
} else {
  // Not "I gave up" — a proof, naming the group that cannot fit.
  const { people, slots: contested } = exact.bottleneck!;
  console.log(
    `${people.map((p) => p.id).join(', ')} can only attend ` +
      `${contested.map((s) => s.id).join(', ')} — ${people.length} people, ${contested.length} slots`,
  );
}
```

Exact, then genetic for the preferences — the combination worth having both for:

```ts
import { createMeetingProblem, solve, solveMeetingExactly } from '@swiftpost/genetic-solver';

const withPreferences = { ...spec, preferences: { compactDaysWeight: 1 } };
const feasible = solveMeetingExactly(withPreferences);

const result = solve(createMeetingProblem(withPreferences), {
  seed: 1,
  localSearchSteps: 8,
  // Start from a schedule already known to work, so the whole budget goes on
  // preferences rather than on rediscovering feasibility.
  initialCandidates: feasible.assignment ? [feasible.assignment] : [],
});
```

## Core concepts

| Piece | Role |
|-------|------|
| `Constraint` | Scores how badly a candidate breaks one rule. `0` means satisfied; larger is worse. |
| `Encoding` | Knows the candidate representation: how to create, mutate, combine, and optionally repair one. |
| `Problem` | An encoding plus its constraints. |
| `solve` | Runs the search and returns the best candidate with a breakdown. |
| `maximumBipartiteMatching` | Solves distinct-assignment exactly, with a proof when it cannot. |

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
| `localSearchSteps` | 0 | integer >= 0 | Hill-climbing steps per candidate. `0` disables local search. |
| `initialCandidates` | none | at most `populationSize` | Seed the initial population with known-good candidates. |

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

## Local search

Crossover and mutation are good at finding the neighbourhood of a solution and bad at the endgame.
Closing the last violation usually takes two coordinated changes, and neither half improves anything
on its own, so selection rejects both. The measured symptom is a search that gets to 149 bookings out
of 150 and reports `stalled` — on an instance that is provably solvable.

Setting `localSearchSteps` gives each new candidate that many first-improvement hill-climbing steps.
It accepts strictly better neighbours only; accepting equal ones lets the climb drift across a plateau
and burn its budget. Every step counts toward `evaluations`, so the cost is visible.

| 200 population, seed 1 | `localSearchSteps: 0` | `localSearchSteps: 10` |
|---|---|---|
| 150 people / 200 slots | 1 clash, `stalled`, 946ms | solved, 465ms |
| 300 people / 400 slots | 3 clashes, `stalled`, 3158ms | solved, 2604ms |

Where the win comes from is the *neighbour*, not the climbing. `Encoding.neighbour` defaults to
`mutate`, which picks a random position — on a 150-person roster with one clash left, that touches the
guilty pair essentially never. The meeting scenario supplies a conflict-directed neighbour that only
ever moves somebody actually double-booked. If you write your own encoding and want local search to
be worth its cost, define `neighbour` to target what your constraints actually punish.

Local search has a hard limit, and it is worth knowing before relying on it: it cannot help when no
free slot is within reach, because the fix is then a chain of relocations of unbounded length. Tight
instances (as many people as slots) and very large ones still stall. That is what the exact solver is
for.

## The exact solver

`maximumBipartiteMatching` solves "give each left item a distinct right item from its own allowed set"
outright. `solveMeetingExactly` wraps it for the scheduling scenario.

It returns a proof in both directions. A returned assignment is guaranteed valid, not merely the best
found. A failure names the group that cannot fit — a Hall's-theorem witness, `these six people can
only attend these five slots` — which a caller can act on, unlike "no solution found".

| Instance | Genetic search | Exact |
|---|---|---|
| 100 people / 100 slots | 5 clashes, 4.9s | solved, 3.3ms |
| 200 people / 200 slots | 12 clashes, 13s | solved, 3.2ms |
| 600 people / 800 slots | 2 clashes, 35s | solved, 4.8ms |
| 1000 people / 1200 slots | 2 clashes, 56s | solved, 5.5ms |

The genetic column is `populationSize: 100, localSearchSteps: 10, maxGenerations: 2000,
stallGenerations: 300` — that is, the search with local search already switched on, given a generous
budget. Every one of those instances is feasible, verified by matching, so that column is the search
failing rather than the problem being hard.

What matching *cannot* do is trade off preferences — it optimises the number of placed items and
nothing else, and ignores `spec.preferences` entirely. That is the division of labour: matching for
feasibility, `solve` seeded via `initialCandidates` for everything you would merely prefer.

The augmenting-path walk is iterative rather than recursive, because a path can be as long as the left
side and a recursive version would risk the stack on ordinary input. A test exercises a 5000-link
chain.

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

Note what this adds up to: with only the two hard constraints, the scenario reduces to bipartite
matching, and `solveMeetingExactly` is strictly the better tool. `createMeetingProblem` earns its
place once `preferences` are set.

## Choose the encoding before the constraints

A constraint can only fix what the encoding already expresses cheaply. The
clearest measured case is **duration** — an activity occupying several
consecutive slots.

The obvious encoding gives each unit its own variable and ties them together: a
300-minute meal on a 30-minute grid becomes ten declared items, one
all-or-nothing rule and nine adjacency rules. It is correct, and it does not
work. A fortnight of a real calendar, same scenario at four granularities:

| Slot | Grid | Variables | Coupling rules | Result |
|---|---|---|---|---|
| 180 min | 56 | 52 | 10 | not found, 20s |
| 120 min | 98 | 59 | 20 | not found, 39s |
| 60 min | 196 | 95 | 81 | not found, 45s |
| 30 min | 392 | 166 | 165 | not found, 104s |

Every instance is comfortably feasible by hand, and raising the budget does not
help — 3000 generations stall at the same point as 400. The reason is the one
the local-search section already describes: no move can shift a chained block,
because relocating one unit breaks two adjacency rules and scores strictly
worse, so selection rejects it. Chain count, not grid size, is the wall — it
solves at 9 coupling rules and dies at 19.

The same fortnight re-encoded with **one variable per activity holding its start
slot**, duration as data, occupancy spread over `[start, start + length)`:

| Slot | Grid | Variables | Constraints | Result |
|---|---|---|---|---|
| 180 min | 56 | 48 | 3 | solved, 0.98s |
| 120 min | 98 | 48 | 3 | solved, 0.55s |
| 60 min | 196 | 48 | 3 | solved, 0.32s |
| 30 min | 392 | 48 | 3 | solved, 0.42s |

Nothing about the search changed. Relocating a block became a single move, and
nine rules per activity dissolved into the representation.

Two corollaries from the same exercise:

- **Confine the domain rather than scoring it.** Restricting allowed *start*
  values to those where a block fits inside its day, and inside the days it is
  permitted, makes those rules unviolatable instead of penalised — the same
  trick `meeting-scheduling.ts` uses for availability.
- **"Must span a window" is a domain computation, not a constraint.** "This
  visit includes dinner" is `start <= dinnerStart && start + length >= dinnerEnd`
  evaluated over candidate starts. It prunes the domain and costs the search
  nothing.

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
`Encoding` directly — `create`, `mutate`, `crossover`, and `neighbour` must return new values and
never modify their inputs. That last rule is not cosmetic: elitism carries candidate references
between generations, so an operator that edits in place silently corrupts the population.

Before writing constraints, check whether your problem is really distinct assignment in disguise — one
item per slot, drawn from per-item allowed sets. If it is, `maximumBipartiteMatching` will beat
anything you can express as a penalty.

## Commands

```sh
yarn workspace @swiftpost/genetic-solver test       # node:test, no test framework dependency
yarn workspace @swiftpost/genetic-solver lint
yarn workspace @swiftpost/genetic-solver typecheck
```

Tests run on Node's built-in runner with native TypeScript type stripping, which needs **Node 22.6+**
(the repo is on 24). That is why relative imports carry explicit `.ts` extensions — Node's ESM
resolver requires them.

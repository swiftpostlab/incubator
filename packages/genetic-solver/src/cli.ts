/**
 * Command-line front end for the scheduling scenario.
 *
 * Argument parsing, file and stdin reading, and printing. The decisions that
 * are not specific to a terminal — validating a spec and choosing a solver —
 * live in `scenarios/meeting-request.ts`, so the browser front end runs the
 * exact same logic rather than a second copy of it.
 *
 * Usage:
 *   node src/cli.ts <spec.json> [options]
 *   cat spec.json | node src/cli.ts [options]
 */

import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import {
  InputError,
  defaultRunOptions,
  solveRequest,
} from './scenarios/meeting-request.ts';
import type { RequestResult } from './scenarios/meeting-request.ts';

/**
 * Exit codes are distinct so a script can tell the three outcomes apart:
 * a schedule, a proven-impossible request, and the caller getting it wrong.
 */
export const exitCodes = {
  scheduled: 0,
  infeasible: 1,
  badInput: 2,
} as const;

const usage = `Usage: solve <spec.json> [options]

Reads a scheduling spec as JSON, from a file or stdin.

Options:
  --seed <n>            RNG seed for the genetic pass (default 1)
  --local-search <n>    Hill-climbing steps per candidate (default 30)
  --generations <n>     Generation cap for the genetic pass (default 400)
  --json                Emit JSON instead of a human-readable schedule
  --help                Show this message

Roster format — one meeting each, and the exact solver applies:
  {
    "days": ["mon", "tue"],          // with slotsPerDay, builds the grid
    "slotsPerDay": 3,
    "people": [
      { "id": "ana", "availableSlotIds": ["mon#0", "mon#1"] },
      { "id": "bo" }                   // no list: free until a rule says otherwise
    ],
    "preferences": { "compactDaysWeight": 1, "earlinessWeight": 0 }
  }

Plan format — attendee sets, several meetings per person, and rules:
  {
    "days": ["mon", "tue"],
    "slotsPerDay": 3,
    "needs": { "ana": 1, "bo": 2 },  // meetings each person must end up with
    "meetings": [
      { "id": "ana-solo", "attendees": ["ana"] },
      { "id": "joint", "attendees": ["ana", "bo"], "allowedSlotOfDay": [1] },
      { "id": "prep", "attendees": ["bo"], "countsTowardNeeds": false }
    ],
    "rules": [
      { "kind": "spacing", "person": "bo", "minDays": 2 },
      { "kind": "not-same-day", "people": ["ana", "bo"] },
      { "kind": "avoid", "meeting": "joint", "weight": 5 },
      { "kind": "prefer", "person": "ana", "days": ["mon"], "weight": 2 },
      { "kind": "together", "meetings": ["prep", "joint"] },
      { "kind": "consecutive", "first": "prep", "second": "joint" }
    ]
  }

  A meeting takes the availability selectors under its own names —
  "allowedDays", "allowedSlotOfDay", "allowedSlotIds", ANDed together — for a
  limit that belongs to the meeting rather than to a person: "the joint lunch,
  whoever attends". "countsTowardNeeds": false makes it occupy a slot and block
  its attendees' time without counting towards anybody's "needs".

  "prefer" is the soft twin of availability, taking the same selectors: each of
  that person's meetings placed outside the selection costs "weight", so a
  preference bends the plan instead of breaking it. "together" makes a set of
  meetings all-or-nothing, which is the only way to say a meeting exists because
  another was chosen. "consecutive" puts "second" exactly "gap" slots after
  "first" (default 1) on the same day, and says nothing about whether either
  happens — pair it with "together" for "both, adjacent, in this order".

Availability — works with either format, so nobody writes out a complement:
  "availability": [
    { "kind": "busy", "person": "sally", "days": ["tue"] },
    { "kind": "busy", "person": "floyd", "slotOfDay": [1] },
    { "kind": "busy", "person": "paul", "days": ["wed"], "slotOfDay": [1] },
    { "kind": "free", "person": "bo", "days": ["mon", "fri"] }
  ]

  "days" matches the day label exactly, with no date parsing; "slotOfDay" is the
  position within its own day, so 1 is the second slot of every day. Selectors in
  one rule are ANDed — the "paul" rule above is Wednesday lunch only, not all of
  Wednesday. "free" keeps only what it matches, "busy" removes it, and "busy"
  wins on overlap, so order never matters. Use "slotIds" for anything else.

A meeting with no slot limit at all may use any slot.

What costs the proof: "spacing", "not-same-day", "together", "consecutive", and
any meeting with "countsTowardNeeds": false. Each of them either relates two
meetings or makes one optional, which is what the exact solver scores
independently, so a failure then reports that no plan was found rather than
claiming none exists. The preference rules — "avoid", "prefer", "compact-days",
"earliness" — do not affect feasibility and keep the exact route.

Supply "slots" explicitly instead of "days"/"slotsPerDay" for an irregular grid.

Exit codes: ${String(exitCodes.scheduled)} scheduled, ${String(exitCodes.infeasible)} no plan produced, ${String(exitCodes.badInput)} bad input.
`;

/** "1 slot" rather than "1 slots" — the bottleneck message reads as a sentence. */
const count = (value: number, singular: string, plural: string): string =>
  `${String(value)} ${value === 1 ? singular : plural}`;

/**
 * A failure is worth different words depending on whether it is a proof.
 *
 * Printing "no schedule exists" after a search that merely gave up would be the
 * most damaging thing this tool could say, so the two cases never share wording.
 */
const formatFailure = (outcome: RequestResult['outcome']): string => {
  if (outcome.certainty === 'not-found') {
    return [
      'No plan found. This is not a proof: the search gave up, and one may',
      'still exist. Loosen a rule, or retry with --generations raised.',
    ].join('\n');
  }

  const lines = ['No plan exists. This is a proof, not a failed search.'];

  if (outcome.bottleneck) {
    const { meetings, slots } = outcome.bottleneck;
    lines.push(
      '',
      `${count(meetings.length, 'meeting', 'meetings')} can only use ${count(slots.length, 'slot', 'slots')}:`,
      `  meetings: ${meetings.join(', ')}`,
      `  slots:    ${slots.join(', ')}`,
      '',
      "Widen somebody's availability or add a slot they can attend.",
    );
  }

  return lines.join('\n');
};

const formatOutcome = (result: RequestResult): string => {
  const { outcome, plan } = result;

  if (!outcome.scheduled || !plan) {
    return formatFailure(outcome);
  }

  const width = Math.max(
    ...plan.scheduled.map((entry) => entry.meeting.attendees.join(', ').length),
  );

  const rows = plan.scheduled.map(
    (entry) =>
      `  ${entry.meeting.attendees.join(', ').padEnd(width)}  ${entry.slot.id}`,
  );

  const summary = [
    `Scheduled ${count(plan.scheduled.length, 'meeting', 'meetings')} across ${count(plan.days.length, 'day', 'days')} via ${outcome.method}.`,
    '',
    ...rows,
  ];

  if (plan.dropped.length > 0) {
    summary.push(
      '',
      `Not scheduled: ${plan.dropped.map((meeting) => meeting.id).join(', ')}`,
    );
  }

  if (outcome.softViolation !== undefined) {
    summary.push('', `Preference cost: ${outcome.softViolation.toFixed(4)}`);
  }

  return summary.join('\n');
};

const readInput = (path: string | undefined): string => {
  try {
    return readFileSync(path ?? 0, 'utf8');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new InputError(`Could not read the spec: ${reason}`);
  }
};

const numeric = (name: string, value: string | undefined, fallback: number) => {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new InputError(`--${name} needs an integer, received '${value}'`);
  }

  return parsed;
};

export const main = (argv: readonly string[]): number => {
  let parsed;

  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        seed: { type: 'string' },
        'local-search': { type: 'string' },
        generations: { type: 'string' },
        json: { type: 'boolean', default: false },
        help: { type: 'boolean', default: false },
      },
    });
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n\n${usage}`,
    );
    return exitCodes.badInput;
  }

  if (parsed.values.help) {
    process.stdout.write(usage);
    return exitCodes.scheduled;
  }

  try {
    const source = readInput(parsed.positionals[0]);
    const result = solveRequest(source, {
      seed: numeric('seed', parsed.values.seed, defaultRunOptions.seed),
      localSearchSteps: numeric(
        'local-search',
        parsed.values['local-search'],
        defaultRunOptions.localSearchSteps,
      ),
      maxGenerations: numeric(
        'generations',
        parsed.values.generations,
        defaultRunOptions.maxGenerations,
      ),
    });

    process.stdout.write(
      parsed.values.json ?
        `${JSON.stringify(result.outcome, null, 2)}\n`
      : `${formatOutcome(result)}\n`,
    );

    return result.outcome.scheduled ?
        exitCodes.scheduled
      : exitCodes.infeasible;
  } catch (error) {
    // RangeError is what the library throws for a spec that cannot work, so it
    // is the caller's problem, not a crash.
    if (error instanceof InputError || error instanceof RangeError) {
      process.stderr.write(`${error.message}\n`);
      return exitCodes.badInput;
    }

    throw error;
  }
};

// Only runs when executed directly, so importing this module for tests is safe.
if (process.argv[1]?.endsWith('cli.ts') === true) {
  process.exitCode = main(process.argv.slice(2));
}

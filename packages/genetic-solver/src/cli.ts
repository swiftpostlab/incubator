/**
 * Command-line front end for the scheduling scenario.
 *
 * Reads a spec as JSON, picks the right solver for it, and prints either a
 * schedule or the reason none exists. The solver choice is not left to the
 * caller: with no preferences the problem is bipartite matching and gets the
 * exact algorithm, and preferences add a genetic pass seeded from that exact
 * answer. Making that automatic is the point — it is the decision most callers
 * would get wrong, and it is fully determined by the input.
 *
 * Usage:
 *   node src/cli.ts <spec.json> [options]
 *   cat spec.json | node src/cli.ts [options]
 */

import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { solve } from './solver.ts';
import {
  createDailySlots,
  createMeetingProblem,
  describeSchedule,
  solveMeetingExactly,
} from './scenarios/meeting-scheduling.ts';
import type {
  MeetingPreferences,
  MeetingProblemSpec,
  Person,
  Slot,
} from './scenarios/meeting-scheduling.ts';

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
  --local-search <n>    Hill-climbing steps per candidate (default 8)
  --generations <n>     Generation cap for the genetic pass (default 200)
  --json                Emit JSON instead of a human-readable schedule
  --help                Show this message

Spec format:
  {
    "days": ["mon", "tue"],          // with slotsPerDay, builds the grid
    "slotsPerDay": 3,
    "people": [
      { "id": "ana", "availableSlotIds": ["mon#0", "mon#1"] }
    ],
    "preferences": { "compactDaysWeight": 1, "earlinessWeight": 0 }
  }

Supply "slots" explicitly instead of "days"/"slotsPerDay" for an irregular grid.

Exit codes: ${String(exitCodes.scheduled)} scheduled, ${String(exitCodes.infeasible)} no schedule exists, ${String(exitCodes.badInput)} bad input.
`;

interface RawSpec {
  readonly slots?: readonly Slot[];
  readonly days?: readonly string[];
  readonly slotsPerDay?: number;
  readonly people?: readonly Person[];
  readonly preferences?: MeetingPreferences;
}

/** Thrown for anything the caller can fix by changing their input. */
export class InputError extends Error {}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Turn parsed JSON into a spec, or explain what is wrong with it.
 *
 * The checks here are deliberately about *shape*. Everything semantic — unknown
 * slot ids, duplicate ids, more people than slots — is left to the scenario's
 * own validation, so the rules live in one place and the CLI cannot drift from
 * them.
 */
export const parseSpec = (input: unknown): MeetingProblemSpec => {
  if (!isRecord(input)) {
    throw new InputError('The spec must be a JSON object');
  }

  const raw = input as RawSpec;

  if (!Array.isArray(raw.people)) {
    throw new InputError('The spec needs a "people" array');
  }

  raw.people.forEach((person, index) => {
    if (!isRecord(person) || typeof person.id !== 'string') {
      throw new InputError(`people[${String(index)}] needs a string "id"`);
    }

    if (
      !Array.isArray(person.availableSlotIds) ||
      person.availableSlotIds.some((slotId) => typeof slotId !== 'string')
    ) {
      throw new InputError(
        `people[${String(index)}] needs "availableSlotIds" as an array of strings`,
      );
    }
  });

  if (raw.slots !== undefined) {
    if (!Array.isArray(raw.slots)) {
      throw new InputError('"slots" must be an array when given');
    }

    return {
      slots: raw.slots,
      people: raw.people,
      preferences: raw.preferences,
    };
  }

  if (!Array.isArray(raw.days) || typeof raw.slotsPerDay !== 'number') {
    throw new InputError(
      'Give either "slots", or "days" plus "slotsPerDay", to describe the grid',
    );
  }

  return {
    slots: createDailySlots(raw.days, raw.slotsPerDay),
    people: raw.people,
    preferences: raw.preferences,
  };
};

const hasPreferences = (spec: MeetingProblemSpec): boolean => {
  const { compactDaysWeight = 0, earlinessWeight = 0 } = spec.preferences ?? {};
  return compactDaysWeight > 0 || earlinessWeight > 0;
};

export interface RunOptions {
  readonly seed: number;
  readonly localSearchSteps: number;
  readonly maxGenerations: number;
}

export interface RunOutcome {
  readonly scheduled: boolean;
  readonly method: 'exact' | 'exact+genetic';
  readonly assignment?: readonly number[];
  readonly softViolation?: number;
  readonly unplaced: readonly string[];
  readonly bottleneck?: {
    readonly people: readonly string[];
    readonly slots: readonly string[];
  };
}

/**
 * Solve a spec, exact first and genetic only where it adds something.
 *
 * Kept separate from argument parsing and printing so it can be tested without
 * a process, and reused by anything else that wants the same solver choice.
 */
export const run = (
  spec: MeetingProblemSpec,
  options: RunOptions,
): RunOutcome => {
  const exact = solveMeetingExactly(spec);

  if (!exact.feasible || exact.assignment === undefined) {
    return {
      scheduled: false,
      method: 'exact',
      unplaced: exact.unplaced.map((person) => person.id),
      bottleneck: exact.bottleneck && {
        people: exact.bottleneck.people.map((person) => person.id),
        slots: exact.bottleneck.slots.map((slot) => slot.id),
      },
    };
  }

  if (!hasPreferences(spec)) {
    return {
      scheduled: true,
      method: 'exact',
      assignment: exact.assignment,
      unplaced: [],
    };
  }

  const refined = solve(createMeetingProblem(spec), {
    seed: options.seed,
    localSearchSteps: options.localSearchSteps,
    maxGenerations: options.maxGenerations,
    initialCandidates: [exact.assignment],
  });

  // The seed is already feasible and seeding cannot make the best worse, so this
  // is belt and braces rather than a real branch — but a silent downgrade from a
  // valid schedule to an invalid one is exactly the bug worth being loud about.
  if (!refined.best.feasible) {
    return {
      scheduled: true,
      method: 'exact',
      assignment: exact.assignment,
      unplaced: [],
    };
  }

  return {
    scheduled: true,
    method: 'exact+genetic',
    assignment: refined.best.candidate,
    softViolation: refined.best.softViolation,
    unplaced: [],
  };
};

/** "1 slot" rather than "1 slots" — the bottleneck message reads as a sentence. */
const count = (value: number, singular: string, plural: string): string =>
  `${String(value)} ${value === 1 ? singular : plural}`;

const formatOutcome = (
  spec: MeetingProblemSpec,
  outcome: RunOutcome,
): string => {
  if (!outcome.scheduled) {
    const lines = ['No schedule exists. This is a proof, not a failed search.'];

    if (outcome.bottleneck) {
      const { people, slots } = outcome.bottleneck;
      lines.push(
        '',
        `${count(people.length, 'person', 'people')} can only attend ${count(slots.length, 'slot', 'slots')}:`,
        `  people: ${people.join(', ')}`,
        `  slots:  ${slots.join(', ')}`,
        '',
        "Widen somebody's availability or add a slot they can attend.",
      );
    }

    return lines.join('\n');
  }

  const schedule = describeSchedule(spec, outcome.assignment ?? []);
  const width = Math.max(
    ...schedule.meetings.map((meeting) => meeting.person.id.length),
  );

  const rows = [...schedule.meetings]
    .sort((left, right) => left.slot.index - right.slot.index)
    .map(
      (meeting) => `  ${meeting.person.id.padEnd(width)}  ${meeting.slot.id}`,
    );

  const summary = [
    `Scheduled ${count(schedule.meetings.length, 'meeting', 'meetings')} across ${count(schedule.days.length, 'day', 'days')} via ${outcome.method}.`,
    '',
    ...rows,
  ];

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
    let json: unknown;

    try {
      json = JSON.parse(source);
    } catch (error) {
      throw new InputError(
        `The spec is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const spec = parseSpec(json);
    const outcome = run(spec, {
      seed: numeric('seed', parsed.values.seed, 1),
      localSearchSteps: numeric(
        'local-search',
        parsed.values['local-search'],
        8,
      ),
      maxGenerations: numeric('generations', parsed.values.generations, 200),
    });

    process.stdout.write(
      parsed.values.json ?
        `${JSON.stringify(outcome, null, 2)}\n`
      : `${formatOutcome(spec, outcome)}\n`,
    );

    return outcome.scheduled ? exitCodes.scheduled : exitCodes.infeasible;
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

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

import { describeSchedule } from './scenarios/meeting-scheduling.ts';
import {
  InputError,
  defaultRunOptions,
  solveRequest,
} from './scenarios/meeting-request.ts';
import type { RunOutcome } from './scenarios/meeting-request.ts';
import type { MeetingProblemSpec } from './scenarios/meeting-scheduling.ts';

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
    const { spec, outcome } = solveRequest(source, {
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

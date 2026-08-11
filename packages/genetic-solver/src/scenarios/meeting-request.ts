/**
 * Untrusted input to a solved outcome, for any front end.
 *
 * This is the layer both consumers share: the CLI reads a spec from a file, a
 * browser reads one from a textarea, and neither should be deciding which
 * solver to use or re-implementing shape checks. Everything here is free of
 * runtime-specific imports so it loads in Node and in a bundle alike — the
 * reason it lives outside `cli.ts` rather than in it.
 *
 * The solver choice is deliberately not a parameter. With no preferences the
 * problem is bipartite matching and gets the exact algorithm; preferences add a
 * genetic pass seeded from that exact answer. That is the decision a caller is
 * most likely to get wrong, and it is fully determined by the input.
 */

import { solve } from '../solver.ts';
import {
  createDailySlots,
  createMeetingProblem,
  solveMeetingExactly,
} from './meeting-scheduling.ts';
import type {
  MeetingPreferences,
  MeetingProblemSpec,
  Person,
  Slot,
} from './meeting-scheduling.ts';

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
 * own validation, so the rules live in one place and front ends cannot drift
 * from them.
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

/** Defaults every front end starts from, so they agree without coordinating. */
export const defaultRunOptions: RunOptions = {
  seed: 1,
  localSearchSteps: 8,
  maxGenerations: 200,
};

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
  options: RunOptions = defaultRunOptions,
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

/**
 * Parse and solve in one step, the whole job for a front end holding raw text.
 *
 * Both failure modes surface as exceptions the caller can show verbatim:
 * `InputError` for a malformed spec, `RangeError` for one the scenario rejects.
 */
export const solveRequest = (
  json: string,
  options: RunOptions = defaultRunOptions,
): { spec: MeetingProblemSpec; outcome: RunOutcome } => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new InputError(
      `The spec is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const spec = parseSpec(parsed);

  return { spec, outcome: run(spec, options) };
};

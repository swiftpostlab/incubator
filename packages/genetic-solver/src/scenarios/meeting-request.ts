/**
 * Untrusted input to a solved plan, for any front end.
 *
 * This is the layer both consumers share: the CLI reads a spec from a file, a
 * browser reads one from a textarea, and neither should be deciding which
 * solver to use or re-implementing shape checks. Everything here is free of
 * runtime-specific imports so it loads in Node and in a bundle alike.
 *
 * Two input shapes are accepted and both become a `MeetingPlanSpec`:
 *
 * - the **roster** shape — `people` with `availableSlotIds` — which is the
 *   common "give everyone one meeting" case and stays short to write;
 * - the **plan** shape — explicit `meetings` with attendees, plus `needs` and
 *   `rules` — for anything the roster shape cannot say.
 *
 * Converting the first into the second rather than solving it separately is
 * deliberate: one solver path means the two shapes cannot drift apart, and a
 * roster still routes to the exact solver because it satisfies every condition
 * in `planIsExactlySolvable`.
 */

import { createDailySlots } from './meeting-scheduling.ts';
import { describePlan, solvePlan } from './meeting-plan.ts';
import type {
  MeetingPlanSpec,
  MeetingRule,
  PlanDescription,
  PlanOptions,
  PlanOutcome,
  PlannedMeeting,
} from './meeting-plan.ts';
import type { Person, Slot } from './meeting-scheduling.ts';

interface RawSpec {
  readonly slots?: readonly Slot[];
  readonly days?: readonly string[];
  readonly slotsPerDay?: number;
  readonly people?: readonly Person[];
  readonly preferences?: {
    readonly compactDaysWeight?: number;
    readonly earlinessWeight?: number;
  };
  readonly meetings?: readonly PlannedMeeting[];
  readonly needs?: Readonly<Record<string, number>>;
  readonly rules?: readonly MeetingRule[];
  readonly slotCapacity?: number;
}

/** Thrown for anything the caller can fix by changing their input. */
export class InputError extends Error {}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Read the slot grid, which both shapes describe the same way.
 *
 * `slots` given explicitly wins; otherwise `days` plus `slotsPerDay` builds the
 * regular grid that covers almost every real request.
 */
const parseSlots = (raw: RawSpec): readonly Slot[] => {
  if (raw.slots !== undefined) {
    const given: readonly unknown[] = raw.slots;

    if (!Array.isArray(given) || given.length === 0) {
      throw new InputError('"slots" must be a non-empty array when given');
    }

    given.forEach((slot, index) => {
      if (
        !isRecord(slot) ||
        typeof slot.id !== 'string' ||
        typeof slot.day !== 'string' ||
        typeof slot.index !== 'number'
      ) {
        throw new InputError(
          `slots[${String(index)}] needs a string "id", a string "day", and a numeric "index"`,
        );
      }
    });

    return raw.slots;
  }

  if (!Array.isArray(raw.days) || typeof raw.slotsPerDay !== 'number') {
    throw new InputError(
      'Give either "slots", or "days" plus "slotsPerDay", to describe the grid',
    );
  }

  return createDailySlots(raw.days, raw.slotsPerDay);
};

const parseRoster = (raw: RawSpec, slots: readonly Slot[]): MeetingPlanSpec => {
  const people = raw.people ?? [];

  people.forEach((person, index) => {
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

  const { compactDaysWeight = 0, earlinessWeight = 0 } = raw.preferences ?? {};
  const rules: MeetingRule[] = [];

  if (compactDaysWeight > 0) {
    rules.push({ kind: 'compact-days', weight: compactDaysWeight });
  }

  if (earlinessWeight > 0) {
    rules.push({ kind: 'earliness', weight: earlinessWeight });
  }

  return {
    slots,
    meetings: people.map((person) => ({
      id: person.id,
      attendees: [person.id],
      allowedSlotIds: person.availableSlotIds,
    })),
    needs: Object.fromEntries(people.map((person) => [person.id, 1])),
    rules,
  };
};

const parsePlan = (raw: RawSpec, slots: readonly Slot[]): MeetingPlanSpec => {
  const meetings = raw.meetings ?? [];

  meetings.forEach((meeting, index) => {
    if (!isRecord(meeting) || typeof meeting.id !== 'string') {
      throw new InputError(`meetings[${String(index)}] needs a string "id"`);
    }

    if (
      !Array.isArray(meeting.attendees) ||
      meeting.attendees.some((attendee) => typeof attendee !== 'string')
    ) {
      throw new InputError(
        `meetings[${String(index)}] needs "attendees" as an array of strings`,
      );
    }

    if (
      meeting.allowedSlotIds !== undefined &&
      (!Array.isArray(meeting.allowedSlotIds) ||
        meeting.allowedSlotIds.some((slotId) => typeof slotId !== 'string'))
    ) {
      throw new InputError(
        `meetings[${String(index)}] "allowedSlotIds" must be an array of strings`,
      );
    }
  });

  if (!isRecord(raw.needs)) {
    throw new InputError(
      'A plan needs a "needs" object saying how many meetings each person gets',
    );
  }

  for (const [person, count] of Object.entries(raw.needs)) {
    if (typeof count !== 'number') {
      throw new InputError(`needs['${person}'] must be a number`);
    }
  }

  if (raw.rules !== undefined && !Array.isArray(raw.rules)) {
    throw new InputError('"rules" must be an array when given');
  }

  return {
    slots,
    meetings,
    needs: raw.needs,
    rules: raw.rules,
    slotCapacity: raw.slotCapacity,
  };
};

/**
 * Turn parsed JSON into a plan, or explain what is wrong with it.
 *
 * The checks here are deliberately about *shape*. Everything semantic — unknown
 * slot ids, attendees missing from `needs`, more meetings than slots — is left
 * to the plan's own validation, so the rules live in one place and front ends
 * cannot drift from them.
 */
export const parseSpec = (input: unknown): MeetingPlanSpec => {
  if (!isRecord(input)) {
    throw new InputError('The spec must be a JSON object');
  }

  const raw = input as RawSpec;
  const slots = parseSlots(raw);

  if (raw.meetings !== undefined) {
    if (!Array.isArray(raw.meetings)) {
      throw new InputError('"meetings" must be an array when given');
    }

    return parsePlan(raw, slots);
  }

  if (!Array.isArray(raw.people)) {
    throw new InputError(
      'The spec needs either a "people" array or a "meetings" array',
    );
  }

  return parseRoster(raw, slots);
};

export type RunOptions = PlanOptions;

/** Defaults every front end starts from, so they agree without coordinating. */
export const defaultRunOptions: Required<PlanOptions> = {
  seed: 1,
  populationSize: 200,
  maxGenerations: 400,
  localSearchSteps: 30,
};

export interface RequestResult {
  readonly spec: MeetingPlanSpec;
  readonly outcome: PlanOutcome;
  /** Present only when a plan was found. */
  readonly plan?: PlanDescription;
}

/**
 * Solve a parsed spec, letting the plan decide which solver it deserves.
 *
 * Kept separate from argument parsing and printing so it can be tested without
 * a process, and reused by anything else that wants the same routing.
 */
export const run = (
  spec: MeetingPlanSpec,
  options: PlanOptions = {},
): RequestResult => {
  const outcome = solvePlan(spec, options);

  return {
    spec,
    outcome,
    plan: outcome.candidate && describePlan(spec, outcome.candidate),
  };
};

/**
 * Parse and solve in one step, the whole job for a front end holding raw text.
 *
 * Both failure modes surface as exceptions the caller can show verbatim:
 * `InputError` for a malformed spec, `RangeError` for one the plan rejects.
 */
export const solveRequest = (
  json: string,
  options: PlanOptions = {},
): RequestResult => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new InputError(
      `The spec is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return run(parseSpec(parsed), options);
};

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
 *
 * Both shapes may also carry `availability` rules, which compile down to the
 * per-meeting slot lists the plan already understands. That compiler is the
 * reason this module exists in its current size: without it, "busy every
 * Tuesday" has to be written as the complement of itself, one slot id at a
 * time, and silently means something else as soon as the grid changes.
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

/**
 * When one person can or cannot meet, said as a rule instead of a slot list.
 *
 * The three selectors are ANDed within a rule and ORed within themselves, so
 * `{ days: ['wed'], slotOfDay: [1] }` is "Wednesday lunch" while two separate
 * rules would be "all of Wednesday, and every lunch". At least one selector is
 * required — a rule selecting everything is far more likely to be a mistake
 * than an intent.
 *
 * `slotOfDay` counts position *within its day*, not `Slot.index`, which is a
 * whole-grid ordinal. On a grid of three slots a day, `slotOfDay: [1]` is the
 * middle slot of every day; `Slot.index === 1` would be one slot on day one.
 */
export interface AvailabilityRule {
  /** `busy` removes the matched slots; `free` keeps only them. */
  readonly kind: 'busy' | 'free';
  readonly person: string;
  /** Matched against `Slot.day` exactly. No date parsing is attempted. */
  readonly days?: readonly string[];
  /** Zero-based position within the day, ordered by `Slot.index`. */
  readonly slotOfDay?: readonly number[];
  /** The escape hatch, for availability no selector describes. */
  readonly slotIds?: readonly string[];
}

/**
 * A roster entry before availability is resolved.
 *
 * `availableSlotIds` is optional here but required on `Person`, because a
 * roster may now state availability as rules instead — and a person with
 * neither is simply free all week.
 */
type RawPerson = Omit<Person, 'availableSlotIds'> & {
  readonly availableSlotIds?: readonly string[];
};

interface RawSpec {
  readonly slots?: readonly Slot[];
  readonly days?: readonly string[];
  readonly slotsPerDay?: number;
  readonly availability?: readonly AvailabilityRule[];
  readonly people?: readonly RawPerson[];
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

const parseAvailability = (raw: RawSpec): readonly AvailabilityRule[] => {
  if (raw.availability === undefined) {
    return [];
  }

  const given: readonly unknown[] = raw.availability;

  if (!Array.isArray(given)) {
    throw new InputError('"availability" must be an array when given');
  }

  given.forEach((rule, index) => {
    const where = `availability[${String(index)}]`;

    if (!isRecord(rule)) {
      throw new InputError(`${where} must be an object`);
    }

    if (rule.kind !== 'busy' && rule.kind !== 'free') {
      throw new InputError(`${where} needs "kind" to be "busy" or "free"`);
    }

    if (typeof rule.person !== 'string') {
      throw new InputError(`${where} needs a string "person"`);
    }

    for (const field of ['days', 'slotIds'] as const) {
      const value: unknown = rule[field];

      if (
        value !== undefined &&
        (!Array.isArray(value) ||
          value.some((entry) => typeof entry !== 'string'))
      ) {
        throw new InputError(`${where} "${field}" must be an array of strings`);
      }
    }

    if (
      rule.slotOfDay !== undefined &&
      (!Array.isArray(rule.slotOfDay) ||
        rule.slotOfDay.some(
          (position) => !Number.isInteger(position) || Number(position) < 0,
        ))
    ) {
      throw new InputError(
        `${where} "slotOfDay" must be an array of integers >= 0`,
      );
    }

    if (
      rule.days === undefined &&
      rule.slotOfDay === undefined &&
      rule.slotIds === undefined
    ) {
      throw new InputError(
        `${where} needs at least one of "days", "slotOfDay", or "slotIds"`,
      );
    }
  });

  return raw.availability;
};

/**
 * Where each slot sits inside its own day, ordered by `Slot.index`.
 *
 * Derived rather than stored, so it stays correct on an irregular grid where
 * one day offers more slots than another, and needs no change to `Slot`.
 */
const positionsWithinDay = (
  slots: readonly Slot[],
): ReadonlyMap<string, number> => {
  const byDay = new Map<string, Slot[]>();

  for (const slot of slots) {
    const existing = byDay.get(slot.day);

    if (existing) {
      existing.push(slot);
    } else {
      byDay.set(slot.day, [slot]);
    }
  }

  const positions = new Map<string, number>();

  for (const daySlots of byDay.values()) {
    [...daySlots]
      .sort((left, right) => left.index - right.index)
      .forEach((slot, position) => positions.set(slot.id, position));
  }

  return positions;
};

/**
 * Compile availability rules into the per-meeting slot lists the plan uses.
 *
 * Pure, and deliberately separate from the solver: this is where a "busy every
 * Tuesday" turns into slot ids, and getting it wrong produces a plan that looks
 * valid and quietly ignores the rule. Everything a rule can name is checked
 * against the grid first, so a typo or a stale day label fails loudly rather
 * than matching nothing.
 *
 * A person's own `free` rules union together — two of them mean "either of
 * these" — and `busy` is subtracted afterwards, so the outcome does not depend
 * on the order rules were written in.
 */
export const applyAvailability = (
  spec: MeetingPlanSpec,
  rules: readonly AvailabilityRule[],
): MeetingPlanSpec => {
  if (rules.length === 0) {
    return spec;
  }

  const slotIds = spec.slots.map((slot) => slot.id);
  const knownSlotIds = new Set(slotIds);
  const knownDays = new Set(spec.slots.map((slot) => slot.day));
  const positions = positionsWithinDay(spec.slots);
  const knownPositions = new Set(positions.values());

  for (const rule of rules) {
    if (!(rule.person in spec.needs)) {
      throw new InputError(
        `An availability rule names '${rule.person}', who is not in this spec`,
      );
    }

    for (const day of rule.days ?? []) {
      if (!knownDays.has(day)) {
        throw new InputError(
          `An availability rule for '${rule.person}' names unknown day '${day}'`,
        );
      }
    }

    for (const slotId of rule.slotIds ?? []) {
      if (!knownSlotIds.has(slotId)) {
        throw new InputError(
          `An availability rule for '${rule.person}' names unknown slot '${slotId}'`,
        );
      }
    }

    for (const position of rule.slotOfDay ?? []) {
      if (!knownPositions.has(position)) {
        throw new InputError(
          `An availability rule for '${rule.person}' names slot ${String(position)} of the day, but no day has that many slots`,
        );
      }
    }
  }

  const matches = (rule: AvailabilityRule, slot: Slot): boolean =>
    (rule.days?.includes(slot.day) ?? true) &&
    (rule.slotIds?.includes(slot.id) ?? true) &&
    (rule.slotOfDay?.includes(positions.get(slot.id) ?? -1) ?? true);

  const people = new Set(rules.map((rule) => rule.person));
  const allowedByPerson = new Map<string, ReadonlySet<string>>();

  for (const person of people) {
    const own = rules.filter((rule) => rule.person === person);
    const free = own.filter((rule) => rule.kind === 'free');
    const busy = own.filter((rule) => rule.kind === 'busy');

    const allowed = spec.slots
      .filter(
        (slot) =>
          (free.length === 0 || free.some((rule) => matches(rule, slot))) &&
          !busy.some((rule) => matches(rule, slot)),
      )
      .map((slot) => slot.id);

    if (allowed.length === 0) {
      throw new InputError(
        `Availability rules leave '${person}' with no slot at all`,
      );
    }

    allowedByPerson.set(person, new Set(allowed));
  }

  return {
    ...spec,
    meetings: spec.meetings.map((meeting) => {
      const limits = meeting.attendees.flatMap((attendee) => {
        const allowed = allowedByPerson.get(attendee);

        return allowed ? [allowed] : [];
      });

      if (limits.length === 0) {
        return meeting;
      }

      const allowedSlotIds = (meeting.allowedSlotIds ?? slotIds).filter(
        (slotId) => limits.every((allowed) => allowed.has(slotId)),
      );

      if (allowedSlotIds.length === 0) {
        throw new InputError(
          `Availability rules leave meeting '${meeting.id}' (${meeting.attendees.join(', ')}) with no slot it can use`,
        );
      }

      return { ...meeting, allowedSlotIds };
    }),
  };
};

const parseRoster = (raw: RawSpec, slots: readonly Slot[]): MeetingPlanSpec => {
  const people = raw.people ?? [];

  people.forEach((person, index) => {
    if (!isRecord(person) || typeof person.id !== 'string') {
      throw new InputError(`people[${String(index)}] needs a string "id"`);
    }

    if (
      person.availableSlotIds !== undefined &&
      (!Array.isArray(person.availableSlotIds) ||
        person.availableSlotIds.some((slotId) => typeof slotId !== 'string'))
    ) {
      throw new InputError(
        `people[${String(index)}] "availableSlotIds" must be an array of strings`,
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
  const availability = parseAvailability(raw);

  if (raw.meetings !== undefined) {
    if (!Array.isArray(raw.meetings)) {
      throw new InputError('"meetings" must be an array when given');
    }

    return applyAvailability(parsePlan(raw, slots), availability);
  }

  if (!Array.isArray(raw.people)) {
    throw new InputError(
      'The spec needs either a "people" array or a "meetings" array',
    );
  }

  return applyAvailability(parseRoster(raw, slots), availability);
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

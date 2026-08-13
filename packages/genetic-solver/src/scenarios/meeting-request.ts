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
 * Both shapes may also carry `availability` rules, and a plan's meetings may
 * carry `allowedDays` and `allowedSlotOfDay`, all of which compile down to the
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
 * A way of naming slots that does not depend on how the grid is laid out.
 *
 * The three selectors are ANDed within one selector and ORed within themselves,
 * so `{ days: ['wed'], slotOfDay: [1] }` is "Wednesday lunch" while two separate
 * rules would be "all of Wednesday, and every lunch".
 *
 * `slotOfDay` counts position *within its day*, not `Slot.index`, which is a
 * whole-grid ordinal. On a grid of three slots a day, `slotOfDay: [1]` is the
 * middle slot of every day; `Slot.index === 1` would be one slot on day one.
 *
 * One shape serves availability rules, meeting-scoped limits, and preference
 * rules, because "which slots do you mean" is the same question in all three.
 */
export interface SlotSelector {
  /** Matched against `Slot.day` exactly. No date parsing is attempted. */
  readonly days?: readonly string[];
  /** Zero-based position within the day, ordered by `Slot.index`. */
  readonly slotOfDay?: readonly number[];
  /** The escape hatch, for a set no selector describes. */
  readonly slotIds?: readonly string[];
}

/**
 * When one person can or cannot meet, said as a rule instead of a slot list.
 *
 * At least one selector is required — a rule selecting everything is far more
 * likely to be a mistake than an intent.
 */
export interface AvailabilityRule extends SlotSelector {
  /** `busy` removes the matched slots; `free` keeps only them. */
  readonly kind: 'busy' | 'free';
  readonly person: string;
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

/**
 * A meeting before its selectors are resolved.
 *
 * `allowedSlotIds` is the plan's own field and survives untouched; the other two
 * are compiled into it here, so the plan model keeps dealing in slot ids alone.
 * Availability is scoped to a *person*, which is why a meeting needs its own
 * limits: "the joint lunch, whenever that is" is not a fact about an attendee.
 */
type RawMeeting = PlannedMeeting & {
  readonly allowedDays?: readonly string[];
  readonly allowedSlotOfDay?: readonly number[];
};

/**
 * A `prefer` rule before its selectors are resolved.
 *
 * Everything else in `MeetingRule` names meetings and people, which the plan
 * checks itself. Only this one names slots, so only this one is compiled here.
 */
type RawPreferRule = Omit<Extract<MeetingRule, { kind: 'prefer' }>, 'slotIds'> &
  SlotSelector;

type RawRule = Exclude<MeetingRule, { kind: 'prefer' }> | RawPreferRule;

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
  readonly meetings?: readonly RawMeeting[];
  readonly needs?: Readonly<Record<string, number>>;
  readonly rules?: readonly RawRule[];
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

/**
 * The three raw values of a selector, under whatever names the input uses.
 *
 * A meeting says `allowedDays` while an availability rule says `days`, but they
 * mean the same thing, so the shape check and the resolution below are shared
 * and only the labels differ — which keeps error messages pointing at what the
 * caller actually wrote.
 */
interface RawSelector {
  readonly days: { readonly name: string; readonly value: unknown };
  readonly slotOfDay: { readonly name: string; readonly value: unknown };
  readonly slotIds: { readonly name: string; readonly value: unknown };
}

const parseSelector = (raw: RawSelector, where: string): SlotSelector => {
  for (const field of [raw.days, raw.slotIds]) {
    if (
      field.value !== undefined &&
      (!Array.isArray(field.value) ||
        field.value.some((entry) => typeof entry !== 'string'))
    ) {
      throw new InputError(
        `${where} "${field.name}" must be an array of strings`,
      );
    }
  }

  const { value: slotOfDay } = raw.slotOfDay;

  if (
    slotOfDay !== undefined &&
    (!Array.isArray(slotOfDay) ||
      slotOfDay.some(
        (position) => !Number.isInteger(position) || Number(position) < 0,
      ))
  ) {
    throw new InputError(
      `${where} "${raw.slotOfDay.name}" must be an array of integers >= 0`,
    );
  }

  return {
    days: raw.days.value as readonly string[] | undefined,
    slotOfDay: slotOfDay as readonly number[] | undefined,
    slotIds: raw.slotIds.value as readonly string[] | undefined,
  };
};

const selectsNothing = (selector: SlotSelector): boolean =>
  selector.days === undefined &&
  selector.slotOfDay === undefined &&
  selector.slotIds === undefined;

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

    const selector = parseSelector(
      {
        days: { name: 'days', value: rule.days },
        slotOfDay: { name: 'slotOfDay', value: rule.slotOfDay },
        slotIds: { name: 'slotIds', value: rule.slotIds },
      },
      where,
    );

    if (selectsNothing(selector)) {
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
 * Turn a selector into the slot ids it names, or say why it names none.
 *
 * Everything a selector can mention is checked against the real grid first, so a
 * typo or a stale day label fails loudly instead of silently matching nothing —
 * which would otherwise produce a plan that looks valid and quietly ignores what
 * was asked for.
 */
const createSlotResolver = (
  slots: readonly Slot[],
): ((selector: SlotSelector, where: string) => readonly string[]) => {
  const positions = positionsWithinDay(slots);
  const knownDays = new Set(slots.map((slot) => slot.day));
  const knownSlotIds = new Set(slots.map((slot) => slot.id));
  const knownPositions = new Set(positions.values());

  return (selector, where) => {
    for (const day of selector.days ?? []) {
      if (!knownDays.has(day)) {
        throw new InputError(`${where} names unknown day '${day}'`);
      }
    }

    for (const slotId of selector.slotIds ?? []) {
      if (!knownSlotIds.has(slotId)) {
        throw new InputError(`${where} names unknown slot '${slotId}'`);
      }
    }

    for (const position of selector.slotOfDay ?? []) {
      if (!knownPositions.has(position)) {
        throw new InputError(
          `${where} names slot ${String(position)} of the day, but no day has that many slots`,
        );
      }
    }

    return slots
      .filter(
        (slot) =>
          (selector.days?.includes(slot.day) ?? true) &&
          (selector.slotIds?.includes(slot.id) ?? true) &&
          (selector.slotOfDay?.includes(positions.get(slot.id) ?? -1) ?? true),
      )
      .map((slot) => slot.id);
  };
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
  const resolve = createSlotResolver(spec.slots);

  for (const rule of rules) {
    if (!(rule.person in spec.needs)) {
      throw new InputError(
        `An availability rule names '${rule.person}', who is not in this spec`,
      );
    }
  }

  const matched = new Map<AvailabilityRule, ReadonlySet<string>>(
    rules.map((rule) => [
      rule,
      new Set(resolve(rule, `An availability rule for '${rule.person}'`)),
    ]),
  );

  const people = new Set(rules.map((rule) => rule.person));
  const allowedByPerson = new Map<string, ReadonlySet<string>>();

  for (const person of people) {
    const own = rules.filter((rule) => rule.person === person);
    const free = own.filter((rule) => rule.kind === 'free');
    const busy = own.filter((rule) => rule.kind === 'busy');
    const hits = (rule: AvailabilityRule, slotId: string): boolean =>
      matched.get(rule)?.has(slotId) ?? false;

    const allowed = slotIds.filter(
      (slotId) =>
        (free.length === 0 || free.some((rule) => hits(rule, slotId))) &&
        !busy.some((rule) => hits(rule, slotId)),
    );

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

/**
 * Compile the rules that name slots, and pass the rest through untouched.
 *
 * A `prefer` rule is the soft twin of availability, so it accepts the same
 * selectors — "weekends, and earlier in the day" should not have to be spelled
 * out slot by slot just because it is a preference rather than a constraint.
 */
const isPreferRule = (rule: RawRule): rule is RawPreferRule =>
  isRecord(rule) && (rule as { readonly kind?: unknown }).kind === 'prefer';

const parseRules = (
  rules: readonly RawRule[],
  resolve: (selector: SlotSelector, where: string) => readonly string[],
): readonly MeetingRule[] =>
  rules.map((rule, index): MeetingRule => {
    const where = `rules[${String(index)}]`;

    if (!isPreferRule(rule)) {
      return rule;
    }

    if (typeof rule.person !== 'string') {
      throw new InputError(`${where} needs a string "person"`);
    }

    const { days, slotOfDay, ...plain } = rule;
    const selector = parseSelector(
      {
        days: { name: 'days', value: days },
        slotOfDay: { name: 'slotOfDay', value: slotOfDay },
        slotIds: { name: 'slotIds', value: plain.slotIds },
      },
      where,
    );

    if (selectsNothing(selector)) {
      throw new InputError(
        `${where} needs at least one of "days", "slotOfDay", or "slotIds"`,
      );
    }

    const slotIds = resolve(selector, where);

    if (slotIds.length === 0) {
      throw new InputError(
        `${where} prefers no slot at all: its selectors have nothing in common`,
      );
    }

    return { ...plain, slotIds };
  });

const parsePlan = (raw: RawSpec, slots: readonly Slot[]): MeetingPlanSpec => {
  const resolve = createSlotResolver(slots);

  const meetings: readonly PlannedMeeting[] = (raw.meetings ?? []).map(
    (meeting, index): PlannedMeeting => {
      const where = `meetings[${String(index)}]`;

      if (!isRecord(meeting) || typeof meeting.id !== 'string') {
        throw new InputError(`${where} needs a string "id"`);
      }

      if (
        !Array.isArray(meeting.attendees) ||
        meeting.attendees.some((attendee) => typeof attendee !== 'string')
      ) {
        throw new InputError(
          `${where} needs "attendees" as an array of strings`,
        );
      }

      if (
        meeting.countsTowardNeeds !== undefined &&
        typeof meeting.countsTowardNeeds !== 'boolean'
      ) {
        throw new InputError(`${where} "countsTowardNeeds" must be a boolean`);
      }

      const { allowedDays, allowedSlotOfDay, ...plain } = meeting;
      const selector = parseSelector(
        {
          days: { name: 'allowedDays', value: allowedDays },
          slotOfDay: { name: 'allowedSlotOfDay', value: allowedSlotOfDay },
          slotIds: { name: 'allowedSlotIds', value: plain.allowedSlotIds },
        },
        where,
      );

      if (selectsNothing(selector)) {
        return plain;
      }

      const allowedSlotIds = resolve(selector, where);

      if (allowedSlotIds.length === 0) {
        throw new InputError(
          `${where} allows no slot at all: its selectors have nothing in common`,
        );
      }

      return { ...plain, allowedSlotIds };
    },
  );

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
    rules: raw.rules && parseRules(raw.rules, resolve),
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

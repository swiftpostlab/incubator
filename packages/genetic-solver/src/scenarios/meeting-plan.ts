/**
 * Meeting planning: place declared meetings, each with its own attendees.
 *
 * This generalises `meeting-scheduling.ts`, which assigns one slot per *person*
 * and so cannot express a meeting with two attendees, a choice between
 * alternative meetings, or a rule relating two people. Here the unit is a
 * declared meeting, and the search decides both when it happens and — through
 * the `unscheduled` option every meeting carries — whether it happens at all.
 *
 * That last part is what lets alternatives compete: declare "Z alone" and
 * "Y and Z together", require Z to end up with one meeting, and discourage the
 * joint one. The search then prefers the solo meeting and falls back to the
 * joint meeting only when the solo one cannot be placed.
 *
 * The cost of this generality is exactness. One person per meeting *is*
 * bipartite matching, which is why `meeting-scheduling.ts` can prove a request
 * impossible. Attendee sets and cross-person rules leave that class — a
 * same-day ban between people is graph colouring — so the general case is
 * searched, not solved. `planIsExactlySolvable` detects the cases that stayed
 * inside matching, and callers should route through it rather than giving up
 * the proof by default.
 */

import { hardConstraint, softConstraint } from '../constraints.ts';
import { createAssignmentEncoding } from '../encodings.ts';
import type { Assignment } from '../encodings.ts';
import type { Constraint, Problem } from '../types.ts';
import type { Slot } from './meeting-scheduling.ts';

/** A meeting someone wants to happen, with the people who would attend it. */
export interface PlannedMeeting {
  readonly id: string;
  /** Everyone required at this meeting. At least one. */
  readonly attendees: readonly string[];
  /** Slot ids it may occupy. Defaults to every slot. */
  readonly allowedSlotIds?: readonly string[];
}

/**
 * Rules that relate meetings to each other, which is exactly what a per-meeting
 * slot list cannot express.
 */
export type MeetingRule =
  /** Keep one person's meetings at least `minDays` apart. */
  | {
      readonly kind: 'spacing';
      readonly person: string;
      readonly minDays: number;
    }
  /** Never put these two people on the same day. */
  | { readonly kind: 'not-same-day'; readonly people: readonly string[] }
  /** Schedule this meeting only if the alternatives do not work out. */
  | {
      readonly kind: 'avoid';
      readonly meeting: string;
      readonly weight?: number;
    };

export interface MeetingPlanSpec {
  readonly slots: readonly Slot[];
  readonly meetings: readonly PlannedMeeting[];
  /** How many meetings each person must end up with. */
  readonly needs: Readonly<Record<string, number>>;
  readonly rules?: readonly MeetingRule[];
  /** Meetings one slot can hold at once. Integer >= 1. Default 1. */
  readonly slotCapacity?: number;
}

/** A meeting that made it into the plan, with the slot it got. */
export interface PlannedResult {
  readonly meeting: PlannedMeeting;
  readonly slot: Slot;
}

export interface PlanDescription {
  readonly scheduled: readonly PlannedResult[];
  /** Declared meetings the plan left out. Empty when every one was placed. */
  readonly dropped: readonly PlannedMeeting[];
  /** Distinct days the plan touches, in slot order. */
  readonly days: readonly string[];
}

const defaultAvoidWeight = 1;

export const validatePlanSpec = (spec: MeetingPlanSpec): void => {
  if (spec.slots.length === 0) {
    throw new RangeError('A meeting plan needs at least one slot');
  }

  if (spec.meetings.length === 0) {
    throw new RangeError('A meeting plan needs at least one meeting');
  }

  const slotIds = new Set(spec.slots.map((slot) => slot.id));

  if (slotIds.size !== spec.slots.length) {
    throw new RangeError('Slot ids must be unique');
  }

  const meetingIds = new Set(spec.meetings.map((meeting) => meeting.id));

  if (meetingIds.size !== spec.meetings.length) {
    throw new RangeError('Meeting ids must be unique');
  }

  const capacity = spec.slotCapacity ?? 1;

  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new RangeError(
      `slotCapacity must be an integer >= 1, received ${String(capacity)}`,
    );
  }

  for (const meeting of spec.meetings) {
    if (meeting.attendees.length === 0) {
      throw new RangeError(`Meeting '${meeting.id}' has no attendees`);
    }

    if (new Set(meeting.attendees).size !== meeting.attendees.length) {
      throw new RangeError(`Meeting '${meeting.id}' lists an attendee twice`);
    }

    for (const attendee of meeting.attendees) {
      if (!(attendee in spec.needs)) {
        throw new RangeError(
          `Meeting '${meeting.id}' includes '${attendee}', who has no entry in "needs"`,
        );
      }
    }

    for (const slotId of meeting.allowedSlotIds ?? []) {
      if (!slotIds.has(slotId)) {
        throw new RangeError(
          `Meeting '${meeting.id}' references unknown slot '${slotId}'`,
        );
      }
    }

    if (meeting.allowedSlotIds?.length === 0) {
      throw new RangeError(
        `Meeting '${meeting.id}' allows no slots, so it can never be scheduled`,
      );
    }
  }

  for (const [person, count] of Object.entries(spec.needs)) {
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError(
        `needs['${person}'] must be an integer >= 0, received ${String(count)}`,
      );
    }

    const available = spec.meetings.filter((meeting) =>
      meeting.attendees.includes(person),
    ).length;

    if (available < count) {
      throw new RangeError(
        `'${person}' needs ${String(count)} meeting(s) but only ${String(available)} were declared`,
      );
    }
  }

  for (const rule of spec.rules ?? []) {
    if (rule.kind === 'spacing') {
      if (!(rule.person in spec.needs)) {
        throw new RangeError(
          `Spacing rule names '${rule.person}', who has no entry in "needs"`,
        );
      }

      if (!Number.isInteger(rule.minDays) || rule.minDays < 0) {
        throw new RangeError(
          `Spacing rule for '${rule.person}' needs an integer minDays >= 0`,
        );
      }
    }

    if (rule.kind === 'not-same-day') {
      if (rule.people.length < 2) {
        throw new RangeError('A not-same-day rule needs at least two people');
      }

      for (const person of rule.people) {
        if (!(person in spec.needs)) {
          throw new RangeError(
            `not-same-day rule names '${person}', who has no entry in "needs"`,
          );
        }
      }
    }

    if (rule.kind === 'avoid') {
      if (!meetingIds.has(rule.meeting)) {
        throw new RangeError(
          `Avoid rule references unknown meeting '${rule.meeting}'`,
        );
      }

      const { weight = defaultAvoidWeight } = rule;

      if (!Number.isFinite(weight) || weight < 0) {
        throw new RangeError(
          `Avoid rule for '${rule.meeting}' needs a finite weight >= 0`,
        );
      }
    }
  }
};

/**
 * Index helpers shared by the encoding and every constraint.
 *
 * `unscheduled` is one past the last slot, so a meeting's domain is its allowed
 * slots plus that sentinel. Making "does not happen" an ordinary value keeps the
 * whole thing inside the existing integer-assignment encoding.
 */
interface PlanIndex {
  readonly unscheduled: number;
  readonly dayOrdinalOf: readonly number[];
  readonly allowedFor: readonly (readonly number[])[];
}

const buildIndex = (spec: MeetingPlanSpec): PlanIndex => {
  const slotIndexById = new Map(
    spec.slots.map((slot, index) => [slot.id, index]),
  );

  const dayOrdinals = new Map<string, number>();
  for (const slot of spec.slots) {
    if (!dayOrdinals.has(slot.day)) {
      dayOrdinals.set(slot.day, dayOrdinals.size);
    }
  }

  return {
    unscheduled: spec.slots.length,
    dayOrdinalOf: spec.slots.map((slot) => dayOrdinals.get(slot.day) ?? 0),
    allowedFor: spec.meetings.map((meeting) =>
      meeting.allowedSlotIds === undefined ?
        spec.slots.map((_, index) => index)
      : meeting.allowedSlotIds.map((slotId) => slotIndexById.get(slotId) ?? 0),
    ),
  };
};

/** Meeting indices a candidate actually scheduled, paired with their slots. */
const placements = (
  candidate: Assignment,
  index: PlanIndex,
): readonly { meeting: number; slot: number }[] =>
  candidate.flatMap((slot, meeting) =>
    slot === index.unscheduled ? [] : [{ meeting, slot }],
  );

const daysUsedBy = (
  person: string,
  spec: MeetingPlanSpec,
  candidate: Assignment,
  index: PlanIndex,
): readonly number[] =>
  placements(candidate, index)
    .filter((placement) =>
      spec.meetings[placement.meeting].attendees.includes(person),
    )
    .map((placement) => index.dayOrdinalOf[placement.slot]);

const buildRuleConstraints = (
  spec: MeetingPlanSpec,
  index: PlanIndex,
): readonly Constraint<Assignment>[] =>
  (spec.rules ?? []).map((rule, ruleIndex) => {
    if (rule.kind === 'spacing') {
      return hardConstraint<Assignment>(
        `spacing:${rule.person}`,
        (candidate) => {
          const days = [
            ...daysUsedBy(rule.person, spec, candidate, index),
          ].sort((left, right) => left - right);

          let violation = 0;
          for (let position = 1; position < days.length; position += 1) {
            violation += Math.max(
              0,
              rule.minDays - (days[position] - days[position - 1]),
            );
          }

          return violation;
        },
      );
    }

    if (rule.kind === 'not-same-day') {
      return hardConstraint<Assignment>(
        `not-same-day:${rule.people.join('+')}`,
        (candidate) => {
          const perPerson = rule.people.map(
            (person) => new Set(daysUsedBy(person, spec, candidate, index)),
          );

          let violation = 0;
          for (let left = 0; left < perPerson.length; left += 1) {
            for (let right = left + 1; right < perPerson.length; right += 1) {
              for (const day of perPerson[left]) {
                if (perPerson[right].has(day)) {
                  violation += 1;
                }
              }
            }
          }

          return violation;
        },
      );
    }

    const target = spec.meetings.findIndex(
      (meeting) => meeting.id === rule.meeting,
    );

    return softConstraint<Assignment>(
      `avoid:${rule.meeting}:${String(ruleIndex)}`,
      (candidate) => (candidate[target] === index.unscheduled ? 0 : 1),
      rule.weight ?? defaultAvoidWeight,
    );
  });

/**
 * Turn a plan into a problem the generic solver can search.
 *
 * Three constraints are structural and always present: everyone ends up with
 * the number of meetings they need, no slot is over its capacity, and nobody is
 * in two meetings at once. Only the last two would be one rule if capacity were
 * always 1 — with capacity above 1 a slot can hold two meetings that must still
 * not share a person.
 */
export const createPlanProblem = (
  spec: MeetingPlanSpec,
): Problem<Assignment> => {
  validatePlanSpec(spec);

  const index = buildIndex(spec);
  const capacity = spec.slotCapacity ?? 1;

  const attendance = hardConstraint<Assignment>('attendance', (candidate) => {
    const placed = new Map<string, number>();

    for (const placement of placements(candidate, index)) {
      for (const attendee of spec.meetings[placement.meeting].attendees) {
        placed.set(attendee, (placed.get(attendee) ?? 0) + 1);
      }
    }

    return Object.entries(spec.needs).reduce(
      (total, [person, needed]) =>
        total + Math.abs((placed.get(person) ?? 0) - needed),
      0,
    );
  });

  const slotCapacity = hardConstraint<Assignment>(
    'slot-capacity',
    (candidate) => {
      const used = new Map<number, number>();

      for (const placement of placements(candidate, index)) {
        used.set(placement.slot, (used.get(placement.slot) ?? 0) + 1);
      }

      return [...used.values()].reduce(
        (total, count) => total + Math.max(0, count - capacity),
        0,
      );
    },
  );

  const doubleBooking = hardConstraint<Assignment>(
    'no-double-booking',
    (candidate) => {
      const perSlot = new Map<number, Map<string, number>>();

      for (const placement of placements(candidate, index)) {
        const attendees =
          perSlot.get(placement.slot) ?? new Map<string, number>();

        for (const attendee of spec.meetings[placement.meeting].attendees) {
          attendees.set(attendee, (attendees.get(attendee) ?? 0) + 1);
        }

        perSlot.set(placement.slot, attendees);
      }

      let violation = 0;
      for (const attendees of perSlot.values()) {
        for (const count of attendees.values()) {
          violation += Math.max(0, count - 1);
        }
      }

      return violation;
    },
  );

  return {
    encoding: createAssignmentEncoding({
      domainSizes: spec.meetings.map(() => spec.slots.length + 1),
      allowedValues: index.allowedFor.map((allowed) => [
        ...allowed,
        index.unscheduled,
      ]),
    }),
    constraints: [
      attendance,
      slotCapacity,
      doubleBooking,
      ...buildRuleConstraints(spec, index),
    ],
  };
};

/** Turn a raw candidate back into something a human can read. */
export const describePlan = (
  spec: MeetingPlanSpec,
  candidate: Assignment,
): PlanDescription => {
  const index = buildIndex(spec);

  const scheduled = placements(candidate, index)
    .map((placement) => ({
      meeting: spec.meetings[placement.meeting],
      slot: spec.slots[placement.slot],
    }))
    .sort((left, right) => left.slot.index - right.slot.index);

  const days: string[] = [];
  for (const entry of scheduled) {
    if (!days.includes(entry.slot.day)) {
      days.push(entry.slot.day);
    }
  }

  return {
    scheduled,
    dropped: spec.meetings.filter(
      (_, meeting) => candidate[meeting] === index.unscheduled,
    ),
    days,
  };
};

/**
 * Whether this plan is still bipartite matching, and so provable rather than
 * merely searchable.
 *
 * All four conditions matter. Multi-attendee meetings and capacity above one
 * break the one-to-one structure; a person with more declared meetings than
 * they need makes *which* meetings happen a decision, which matching cannot
 * make; and a hard rule relating two meetings is exactly what matching scores
 * independently. Soft rules are fine — they do not affect feasibility, so the
 * exact answer stays a valid starting point for the search.
 */
export const planIsExactlySolvable = (spec: MeetingPlanSpec): boolean => {
  validatePlanSpec(spec);

  if ((spec.slotCapacity ?? 1) !== 1) {
    return false;
  }

  if (spec.meetings.some((meeting) => meeting.attendees.length !== 1)) {
    return false;
  }

  if ((spec.rules ?? []).some((rule) => rule.kind !== 'avoid')) {
    return false;
  }

  return Object.entries(spec.needs).every(
    ([person, needed]) =>
      spec.meetings.filter((meeting) => meeting.attendees.includes(person))
        .length === needed,
  );
};

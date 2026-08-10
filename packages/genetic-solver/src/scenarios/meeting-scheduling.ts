/**
 * Meeting scheduling — the reference scenario for this library.
 *
 * The problem: a sequence of days, each offering some slots; a set of people,
 * each available in only some of those slots; and a need to give every person a
 * one-to-one meeting. Find the slot for each person such that nobody is booked
 * when unavailable and no slot holds two meetings at once.
 *
 * It is a useful exercise for the solver because it mixes a genuinely hard
 * constraint (availability), a pairwise one (no double booking), and soft
 * preferences that only matter once the hard ones are met.
 */

import { hardConstraint, softConstraint } from '../constraints.ts';
import { createAssignmentEncoding } from '../encodings.ts';
import type { Assignment } from '../encodings.ts';
import type { Constraint, Problem } from '../types.ts';

export interface Slot {
  readonly id: string;
  /** Day label used for grouping; slots sharing a day are on the same date. */
  readonly day: string;
  /** Ordering within the whole schedule. Lower is earlier. */
  readonly index: number;
}

export interface Person {
  readonly id: string;
  /** Slot ids this person can attend. */
  readonly availableSlotIds: readonly string[];
}

export interface MeetingPreferences {
  /** Pull meetings onto as few distinct days as possible. Default 0 (off). */
  readonly compactDaysWeight?: number;
  /** Prefer earlier slots. Default 0 (off). */
  readonly earlinessWeight?: number;
}

export interface MeetingProblemSpec {
  readonly slots: readonly Slot[];
  readonly people: readonly Person[];
  readonly preferences?: MeetingPreferences;
}

/** A person paired with the slot they were given. */
export interface ScheduledMeeting {
  readonly person: Person;
  readonly slot: Slot;
}

export interface Schedule {
  readonly meetings: readonly ScheduledMeeting[];
  /** Distinct days the schedule touches, in first-seen order. */
  readonly days: readonly string[];
}

const validateSpec = (spec: MeetingProblemSpec): void => {
  if (spec.slots.length === 0) {
    throw new RangeError('A meeting problem needs at least one slot');
  }

  if (spec.people.length === 0) {
    throw new RangeError('A meeting problem needs at least one person');
  }

  const slotIds = new Set(spec.slots.map((slot) => slot.id));

  if (slotIds.size !== spec.slots.length) {
    throw new RangeError('Slot ids must be unique');
  }

  const personIds = new Set(spec.people.map((person) => person.id));

  if (personIds.size !== spec.people.length) {
    throw new RangeError('Person ids must be unique');
  }

  for (const person of spec.people) {
    for (const slotId of person.availableSlotIds) {
      if (!slotIds.has(slotId)) {
        throw new RangeError(
          `Person '${person.id}' references unknown slot '${slotId}'`,
        );
      }
    }
  }

  // Caught here rather than left to the search: no assignment can ever satisfy
  // it, so failing loudly beats returning "no solution found" after 500
  // generations and letting the caller guess whether the search was too weak.
  const unschedulable = spec.people.filter(
    (person) => person.availableSlotIds.length === 0,
  );

  if (unschedulable.length > 0) {
    const names = unschedulable.map((person) => person.id).join(', ');
    throw new RangeError(
      `These people have no available slots, so no schedule exists: ${names}`,
    );
  }

  if (spec.people.length > spec.slots.length) {
    throw new RangeError(
      `Cannot give ${String(spec.people.length)} people a private slot when only ` +
        `${String(spec.slots.length)} exist`,
    );
  }
};

/**
 * Build a solvable problem from a scheduling spec.
 *
 * Each person's available slots become their allowed values, which confines the
 * search to the availability-feasible region: `create` and `mutate` only ever
 * draw allowed values, and uniform crossover copies each position from a parent
 * at that same position. So with this encoding, **no operator can produce an
 * unavailable booking, and the `availability` constraint always reads zero**.
 * `no-double-booking` is the only hard constraint the search actually has to
 * work at.
 *
 * `availability` is still declared rather than dropped, for two reasons: it
 * documents the rule as data instead of burying it in the encoding, and it stays
 * correct for a caller who reuses these constraints with their own, unconfined
 * encoding. Both properties are pinned by tests — one asserts the constraint
 * never fires during a real solve, the other asserts it does fire when the
 * encoding is not confined.
 */
export const createMeetingProblem = (
  spec: MeetingProblemSpec,
): Problem<Assignment> => {
  validateSpec(spec);

  const { slots, people } = spec;
  const slotIndexById = new Map(slots.map((slot, index) => [slot.id, index]));

  const allowedValues = people.map((person) =>
    person.availableSlotIds.map((slotId) => slotIndexById.get(slotId) ?? 0),
  );

  const availableSets = people.map(
    (person) => new Set(person.availableSlotIds),
  );

  const encoding = createAssignmentEncoding({
    domainSizes: people.map(() => slots.length),
    allowedValues,
  });

  const constraints: Constraint<Assignment>[] = [
    hardConstraint('availability', (assignment) => {
      let violations = 0;

      assignment.forEach((slotIndex, personIndex) => {
        const slot = slots[slotIndex];
        if (!availableSets[personIndex].has(slot.id)) {
          violations += 1;
        }
      });

      return violations;
    }),

    hardConstraint('no-double-booking', (assignment) => {
      const usage = new Map<number, number>();

      for (const slotIndex of assignment) {
        usage.set(slotIndex, (usage.get(slotIndex) ?? 0) + 1);
      }

      // Count surplus bookings, not clashing slots: three people in one slot is
      // worse than two, and the search needs to see that difference.
      let surplus = 0;
      for (const count of usage.values()) {
        surplus += count - 1;
      }

      return surplus;
    }),
  ];

  const compactDaysWeight = spec.preferences?.compactDaysWeight ?? 0;

  if (compactDaysWeight > 0) {
    constraints.push(
      softConstraint(
        'compact-days',
        (assignment) => {
          const days = new Set(
            assignment.map((slotIndex) => slots[slotIndex].day),
          );
          return days.size - 1;
        },
        compactDaysWeight,
      ),
    );
  }

  const earlinessWeight = spec.preferences?.earlinessWeight ?? 0;

  if (earlinessWeight > 0) {
    const latestIndex = Math.max(...slots.map((slot) => slot.index));

    constraints.push(
      softConstraint(
        'earliness',
        (assignment) => {
          if (latestIndex === 0) {
            return 0;
          }
          // Normalised to [0, 1] per person so the weight means the same thing
          // regardless of how many slots the caller defined.
          const total = assignment.reduce(
            (sum, slotIndex) => sum + slots[slotIndex].index / latestIndex,
            0,
          );
          return total / assignment.length;
        },
        earlinessWeight,
      ),
    );
  }

  return { encoding, constraints };
};

/** Turn a raw assignment back into something a human can read. */
export const describeSchedule = (
  spec: MeetingProblemSpec,
  assignment: Assignment,
): Schedule => {
  const meetings = assignment.map((slotIndex, personIndex) => ({
    person: spec.people[personIndex],
    slot: spec.slots[slotIndex],
  }));

  const days: string[] = [];
  for (const meeting of meetings) {
    if (!days.includes(meeting.slot.day)) {
      days.push(meeting.slot.day);
    }
  }

  return { meetings, days };
};

/** Build a plain day/slot grid, the common case for "a sequence of days". */
export const createDailySlots = (
  days: readonly string[],
  slotsPerDay: number,
): Slot[] => {
  if (slotsPerDay <= 0 || !Number.isInteger(slotsPerDay)) {
    throw new RangeError(
      `slotsPerDay must be a positive integer, received ${String(slotsPerDay)}`,
    );
  }

  return days.flatMap((day, dayIndex) =>
    Array.from({ length: slotsPerDay }, (_unused, slotOfDay) => ({
      id: `${day}#${String(slotOfDay)}`,
      day,
      index: dayIndex * slotsPerDay + slotOfDay,
    })),
  );
};

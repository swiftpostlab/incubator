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
import { maximumBipartiteMatching } from '../exact/bipartite-matching.ts';
import { solve } from '../solver.ts';
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
  /**
   * Whether attending this satisfies part of what its attendees need. Default
   * true.
   *
   * False makes it occupancy rather than a meeting: it still fills a slot and
   * still keeps its attendees from being in two places at once, but it does not
   * count towards `needs`. Cooking the dinner is the case — it takes John's
   * time and is not one of the meetings John owes anyone.
   */
  readonly countsTowardNeeds?: boolean;
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
  /**
   * These meetings all happen, or none of them does.
   *
   * The only way to say that one meeting exists *because* another was chosen.
   * Without it, `needs` forces a meeting always or never: it is exact equality,
   * so a preparation slot either becomes compulsory or gets dropped, and neither
   * is what "only if we eat at home" means.
   */
  | { readonly kind: 'together'; readonly meetings: readonly string[] }
  /**
   * Put `second` exactly `gap` slots after `first`, on the same day.
   *
   * The only rule that relates two meetings' *slots*. `spacing` is a minimum in
   * days with no maximum and no ordering, so it cannot say "the prep is the slot
   * before dinner"; nothing else comes close.
   *
   * Says nothing about whether either meeting happens — when one is unscheduled
   * this is satisfied, and `together` is what couples their existence. Each rule
   * does one thing, and the pair composes into "both, adjacent, in this order".
   */
  | {
      readonly kind: 'consecutive';
      readonly first: string;
      readonly second: string;
      /** Slots between the two, counted by `Slot.index`. Integer >= 1. Default 1. */
      readonly gap?: number;
    }
  /** Schedule this meeting only if the alternatives do not work out. */
  | {
      readonly kind: 'avoid';
      readonly meeting: string;
      readonly weight?: number;
    }
  /**
   * Keep one person's meetings in these slots when the plan can afford it.
   *
   * The soft counterpart to availability. "Weekends are probably better" is not
   * a fact about when someone can meet, and saying it with availability makes it
   * one — the plan then fails rather than costing more. Each of that person's
   * meetings placed outside the set costs `weight`, so the price of ignoring the
   * preference is stated rather than implied.
   */
  | {
      readonly kind: 'prefer';
      readonly person: string;
      readonly slotIds: readonly string[];
      readonly weight?: number;
    }
  /** Pull the plan onto as few distinct days as possible. */
  | { readonly kind: 'compact-days'; readonly weight?: number }
  /** Prefer earlier slots. */
  | { readonly kind: 'earliness'; readonly weight?: number };

/** Rules that express a preference rather than a requirement. */
export type SoftMeetingRule = Extract<MeetingRule, { weight?: number }>;

/**
 * A type guard rather than a set lookup, so narrowing survives: only these
 * rules carry a `weight`, and only these leave feasibility untouched — which is
 * what lets a plan carrying them still take the exact route.
 */
const isSoftRule = (rule: MeetingRule): rule is SoftMeetingRule =>
  rule.kind === 'avoid' ||
  rule.kind === 'prefer' ||
  rule.kind === 'compact-days' ||
  rule.kind === 'earliness';

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

/** Meetings count towards `needs` unless they say otherwise. */
const countsTowardNeeds = (meeting: PlannedMeeting): boolean =>
  meeting.countsTowardNeeds ?? true;

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

    const available = spec.meetings.filter(
      (meeting) =>
        countsTowardNeeds(meeting) && meeting.attendees.includes(person),
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

    if (rule.kind === 'avoid' && !meetingIds.has(rule.meeting)) {
      throw new RangeError(
        `Avoid rule references unknown meeting '${rule.meeting}'`,
      );
    }

    if (rule.kind === 'together') {
      if (rule.meetings.length < 2) {
        throw new RangeError('A together rule needs at least two meetings');
      }

      for (const meeting of rule.meetings) {
        if (!meetingIds.has(meeting)) {
          throw new RangeError(
            `Together rule references unknown meeting '${meeting}'`,
          );
        }
      }
    }

    if (rule.kind === 'consecutive') {
      for (const meeting of [rule.first, rule.second]) {
        if (!meetingIds.has(meeting)) {
          throw new RangeError(
            `Consecutive rule references unknown meeting '${meeting}'`,
          );
        }
      }

      if (rule.first === rule.second) {
        throw new RangeError(
          `Consecutive rule puts '${rule.first}' after itself`,
        );
      }

      const { gap = 1 } = rule;

      if (!Number.isInteger(gap) || gap < 1) {
        throw new RangeError(
          `Consecutive rule for '${rule.first}' needs an integer gap >= 1, received ${String(gap)}`,
        );
      }
    }

    if (rule.kind === 'prefer') {
      if (!(rule.person in spec.needs)) {
        throw new RangeError(
          `Prefer rule names '${rule.person}', who has no entry in "needs"`,
        );
      }

      if (rule.slotIds.length === 0) {
        throw new RangeError(
          `Prefer rule for '${rule.person}' names no slot, so it prefers nothing`,
        );
      }

      for (const slotId of rule.slotIds) {
        if (!slotIds.has(slotId)) {
          throw new RangeError(
            `Prefer rule for '${rule.person}' references unknown slot '${slotId}'`,
          );
        }
      }
    }

    if (isSoftRule(rule)) {
      const { weight = defaultAvoidWeight } = rule;

      if (!Number.isFinite(weight) || weight < 0) {
        throw new RangeError(
          `A '${rule.kind}' rule needs a finite weight >= 0, received ${String(weight)}`,
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

    if (rule.kind === 'together') {
      const targets = rule.meetings.map((id) =>
        spec.meetings.findIndex((meeting) => meeting.id === id),
      );

      return hardConstraint<Assignment>(
        `together:${rule.meetings.join('+')}`,
        (candidate) => {
          const scheduled = targets.filter(
            (target) => candidate[target] !== index.unscheduled,
          ).length;

          // Zero only at all or nothing, and it shrinks as the group agrees,
          // so the search has a direction to move in rather than a cliff.
          return Math.min(scheduled, targets.length - scheduled);
        },
      );
    }

    if (rule.kind === 'consecutive') {
      const first = spec.meetings.findIndex(
        (meeting) => meeting.id === rule.first,
      );
      const second = spec.meetings.findIndex(
        (meeting) => meeting.id === rule.second,
      );
      const gap = rule.gap ?? 1;

      return hardConstraint<Assignment>(
        `consecutive:${rule.first}->${rule.second}`,
        (candidate) => {
          const firstSlot = candidate[first];
          const secondSlot = candidate[second];

          if (
            firstSlot === index.unscheduled ||
            secondSlot === index.unscheduled
          ) {
            return 0;
          }

          const distance =
            spec.slots[secondSlot].index - spec.slots[firstSlot].index;

          // The same-day term is not redundant: on an irregular grid the last
          // slot of one day and the first of the next can be one index apart.
          return (
            Math.abs(distance - gap) +
            (index.dayOrdinalOf[firstSlot] === index.dayOrdinalOf[secondSlot] ?
              0
            : 1)
          );
        },
      );
    }

    if (rule.kind === 'prefer') {
      const preferred = new Set(rule.slotIds);

      return softConstraint<Assignment>(
        `prefer:${rule.person}:${String(ruleIndex)}`,
        (candidate) =>
          placements(candidate, index).filter(
            (placement) =>
              spec.meetings[placement.meeting].attendees.includes(
                rule.person,
              ) && !preferred.has(spec.slots[placement.slot].id),
          ).length,
        rule.weight ?? defaultAvoidWeight,
      );
    }

    if (rule.kind === 'compact-days') {
      return softConstraint<Assignment>(
        `compact-days:${String(ruleIndex)}`,
        (candidate) => {
          const days = new Set(
            placements(candidate, index).map(
              (placement) => index.dayOrdinalOf[placement.slot],
            ),
          );

          return Math.max(0, days.size - 1);
        },
        rule.weight ?? defaultAvoidWeight,
      );
    }

    if (rule.kind === 'earliness') {
      const latestIndex = Math.max(...spec.slots.map((slot) => slot.index));

      return softConstraint<Assignment>(
        `earliness:${String(ruleIndex)}`,
        (candidate) => {
          const placed = placements(candidate, index);

          if (latestIndex === 0 || placed.length === 0) {
            return 0;
          }

          // Normalised to [0, 1] per meeting so the weight means the same thing
          // regardless of how many slots the caller defined.
          const total = placed.reduce(
            (sum, placement) =>
              sum + spec.slots[placement.slot].index / latestIndex,
            0,
          );

          return total / placed.length;
        },
        rule.weight ?? defaultAvoidWeight,
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
      const meeting = spec.meetings[placement.meeting];

      if (!countsTowardNeeds(meeting)) {
        continue;
      }

      for (const attendee of meeting.attendees) {
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
 * All five conditions matter. Multi-attendee meetings and capacity above one
 * break the one-to-one structure; a person with more declared meetings than
 * they need makes *which* meetings happen a decision, which matching cannot
 * make; and a hard rule relating two meetings is exactly what matching scores
 * independently. Soft rules are fine — they do not affect feasibility, so the
 * exact answer stays a valid starting point for the search.
 *
 * A meeting outside `needs` is ruled out for a subtler reason: matching places
 * every meeting or reports failure, but such a meeting is *optional*, so a plan
 * may well exist that simply drops it. Taking the matching's failure as a proof
 * would be claiming impossibility on the strength of a plan nobody required.
 */
export const planIsExactlySolvable = (spec: MeetingPlanSpec): boolean => {
  validatePlanSpec(spec);

  if ((spec.slotCapacity ?? 1) !== 1) {
    return false;
  }

  if (spec.meetings.some((meeting) => meeting.attendees.length !== 1)) {
    return false;
  }

  if (spec.meetings.some((meeting) => !countsTowardNeeds(meeting))) {
    return false;
  }

  if ((spec.rules ?? []).some((rule) => !isSoftRule(rule))) {
    return false;
  }

  return Object.entries(spec.needs).every(
    ([person, needed]) =>
      spec.meetings.filter((meeting) => meeting.attendees.includes(person))
        .length === needed,
  );
};

/**
 * Whether a negative answer is trustworthy.
 *
 * `proof` means no plan can exist — the exact solver said so, and that holds
 * for every possible arrangement. `not-found` means the search gave up, which
 * is a statement about the search and not about the problem. Conflating the two
 * is the failure this type exists to prevent: a genetic search that returns
 * nothing looks identical to an impossibility unless the caller is told which
 * it was.
 */
export type PlanCertainty = 'proof' | 'not-found';

export interface PlanBottleneck {
  readonly meetings: readonly string[];
  readonly slots: readonly string[];
}

export interface PlanOutcome {
  readonly scheduled: boolean;
  /** Which solver produced this. `exact` carries a guarantee; `genetic` does not. */
  readonly method: 'exact' | 'exact+genetic' | 'genetic';
  /**
   * When `scheduled` is false, whether that is a proof or a failed search. When
   * true, always `proof`: a returned plan is checked against every constraint,
   * so it is valid by construction rather than by hope.
   */
  readonly certainty: PlanCertainty;
  readonly candidate?: Assignment;
  readonly softViolation?: number;
  /** Present only for an exact failure: the meetings with nowhere left to go. */
  readonly bottleneck?: PlanBottleneck;
}

export interface PlanOptions {
  readonly seed?: number;
  readonly populationSize?: number;
  readonly maxGenerations?: number;
  readonly localSearchSteps?: number;
}

/**
 * Search defaults sized for the general case rather than the easy one.
 *
 * These are deliberately heavier than the library's own defaults. Plans with
 * attendee sets and coupling rules are constrained enough that a small
 * population rarely finds a feasible point at all, and local search is what
 * closes the last few violations.
 */
export const defaultPlanOptions: Required<PlanOptions> = {
  seed: 1,
  populationSize: 200,
  maxGenerations: 400,
  localSearchSteps: 30,
};

const hasSoftRules = (spec: MeetingPlanSpec): boolean =>
  (spec.rules ?? []).some((rule) => isSoftRule(rule) && (rule.weight ?? 1) > 0);

/**
 * Solve a plan exactly, when it is one of the plans that still can be.
 *
 * Returns `undefined` when the plan left the matching class, so the caller
 * knows to search instead rather than mistaking "not applicable" for "no".
 */
const solvePlanByMatching = (
  spec: MeetingPlanSpec,
): PlanOutcome | undefined => {
  if (!planIsExactlySolvable(spec)) {
    return undefined;
  }

  const index = buildIndex(spec);
  const matching = maximumBipartiteMatching(
    index.allowedFor.map((allowed) => allowed),
    spec.slots.length,
  );

  if (!matching.complete) {
    return {
      scheduled: false,
      method: 'exact',
      certainty: 'proof',
      bottleneck: matching.bottleneck && {
        meetings: matching.bottleneck.leftNodes.map(
          (meeting) => spec.meetings[meeting].id,
        ),
        slots: matching.bottleneck.rightNodes.map(
          (slot) => spec.slots[slot].id,
        ),
      },
    };
  }

  return {
    scheduled: true,
    method: 'exact',
    certainty: 'proof',
    candidate: [...matching.leftMatch],
  };
};

/**
 * Solve a plan, taking the exact route whenever the plan still allows one.
 *
 * The routing is not a caller decision. Whether a plan is bipartite matching is
 * a property of the plan, fully determined by its own contents, and getting it
 * wrong costs either a guarantee or a great deal of time.
 */
export const solvePlan = (
  spec: MeetingPlanSpec,
  options: PlanOptions = {},
): PlanOutcome => {
  validatePlanSpec(spec);

  const settings = { ...defaultPlanOptions, ...options };
  const exact = solvePlanByMatching(spec);

  if (exact && !exact.scheduled) {
    return exact;
  }

  if (exact && !hasSoftRules(spec)) {
    return exact;
  }

  const refined = solve(createPlanProblem(spec), {
    seed: settings.seed,
    populationSize: settings.populationSize,
    maxGenerations: settings.maxGenerations,
    localSearchSteps: settings.localSearchSteps,
    ...(exact?.candidate ? { initialCandidates: [exact.candidate] } : {}),
  });

  if (!refined.best.feasible) {
    // An exact seed is feasible by construction, so reaching here with one in
    // hand would mean the search replaced a valid plan with an invalid one.
    // Hand back the seed rather than the regression.
    if (exact?.candidate) {
      return exact;
    }

    return { scheduled: false, method: 'genetic', certainty: 'not-found' };
  }

  return {
    scheduled: true,
    method: exact ? 'exact+genetic' : 'genetic',
    certainty: 'proof',
    candidate: refined.best.candidate,
    softViolation: refined.best.softViolation,
  };
};

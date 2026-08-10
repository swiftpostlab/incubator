import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { solve } from '../solver.ts';
import { violatedConstraints } from '../constraints.ts';
import { createAssignmentEncoding } from '../encodings.ts';
import type { Assignment } from '../encodings.ts';
import { createRng } from '../random.ts';
import {
  createDailySlots,
  createMeetingProblem,
  describeSchedule,
  solveMeetingExactly,
} from './meeting-scheduling.ts';
import type { MeetingProblemSpec, Person } from './meeting-scheduling.ts';

const days = ['mon', 'tue', 'wed'];
const slots = createDailySlots(days, 3);

/**
 * A heavily contended week: 18 people over 20 slots, each able to attend only a
 * narrow window of 4 consecutive slots, with the windows overlapping. Big enough
 * that the solver has to actually search rather than get lucky on the first
 * population.
 */
const bigSlots = createDailySlots(['mon', 'tue', 'wed', 'thu', 'fri'], 4);
const bigRoster: Person[] = Array.from({ length: 18 }, (_unused, index) => {
  const start = index % (bigSlots.length - 3);
  return {
    id: `p${String(index)}`,
    availableSlotIds: bigSlots
      .filter((slot) => slot.index >= start && slot.index < start + 4)
      .map((slot) => slot.id),
  };
});
const slotId = (day: string, index: number): string =>
  `${day}#${String(index)}`;

/** Checks a schedule against the rules directly, independently of the solver's own scoring. */
const assertScheduleIsValid = (
  spec: MeetingProblemSpec,
  assignment: readonly number[],
): void => {
  const schedule = describeSchedule(spec, assignment);

  assert.equal(
    schedule.meetings.length,
    spec.people.length,
    'every person needs a meeting',
  );

  for (const meeting of schedule.meetings) {
    assert.ok(
      meeting.person.availableSlotIds.includes(meeting.slot.id),
      `${meeting.person.id} was booked into ${meeting.slot.id}, which they cannot attend`,
    );
  }

  const usedSlots = schedule.meetings.map((meeting) => meeting.slot.id);
  assert.equal(
    new Set(usedSlots).size,
    usedSlots.length,
    'no slot may hold two meetings',
  );
};

describe('createDailySlots', () => {
  test('lays out a day/slot grid in order', () => {
    const grid = createDailySlots(['mon', 'tue'], 2);

    assert.deepEqual(
      grid.map((slot) => slot.id),
      ['mon#0', 'mon#1', 'tue#0', 'tue#1'],
    );
    assert.deepEqual(
      grid.map((slot) => slot.index),
      [0, 1, 2, 3],
    );
  });

  test('rejects a non-positive slot count', () => {
    assert.throws(() => createDailySlots(['mon'], 0), RangeError);
  });
});

describe('createMeetingProblem validation', () => {
  const person = (id: string, availableSlotIds: string[]): Person => ({
    id,
    availableSlotIds,
  });

  test('rejects a person with no availability', () => {
    assert.throws(
      () => createMeetingProblem({ slots, people: [person('ana', [])] }),
      /no available slots/,
    );
  });

  test('rejects an unknown slot reference', () => {
    assert.throws(
      () => createMeetingProblem({ slots, people: [person('ana', ['fri#0'])] }),
      /unknown slot/,
    );
  });

  test('rejects more people than slots', () => {
    const tiny = createDailySlots(['mon'], 1);
    assert.throws(
      () =>
        createMeetingProblem({
          slots: tiny,
          people: [person('ana', ['mon#0']), person('bo', ['mon#0'])],
        }),
      /only/,
    );
  });

  test('rejects duplicate ids', () => {
    assert.throws(
      () =>
        createMeetingProblem({
          slots,
          people: [person('ana', ['mon#0']), person('ana', ['tue#0'])],
        }),
      /unique/,
    );
  });
});

describe('meeting scheduling', () => {
  test('schedules everyone when availability is generous', () => {
    const spec: MeetingProblemSpec = {
      slots,
      people: [
        { id: 'ana', availableSlotIds: slots.map((slot) => slot.id) },
        { id: 'bo', availableSlotIds: slots.map((slot) => slot.id) },
        { id: 'cai', availableSlotIds: slots.map((slot) => slot.id) },
      ],
    };

    const result = solve(createMeetingProblem(spec), {
      seed: 1,
      populationSize: 60,
    });

    assert.equal(result.best.feasible, true);
    assert.equal(result.stopReason, 'target-reached');
    assertScheduleIsValid(spec, result.best.candidate);
  });

  test('respects tight availability with a forced single answer', () => {
    // Each person can attend exactly one distinct slot, so exactly one valid
    // schedule exists. The solver must find that specific assignment.
    const spec: MeetingProblemSpec = {
      slots,
      people: [
        { id: 'ana', availableSlotIds: [slotId('mon', 0)] },
        { id: 'bo', availableSlotIds: [slotId('tue', 1)] },
        { id: 'cai', availableSlotIds: [slotId('wed', 2)] },
      ],
    };

    const result = solve(createMeetingProblem(spec), {
      seed: 2,
      populationSize: 40,
    });

    assert.equal(result.best.feasible, true);
    assertScheduleIsValid(spec, result.best.candidate);

    const schedule = describeSchedule(spec, result.best.candidate);
    assert.deepEqual(
      schedule.meetings.map(
        (meeting) => `${meeting.person.id}@${meeting.slot.id}`,
      ),
      ['ana@mon#0', 'bo@tue#1', 'cai@wed#2'],
    );
  });

  test('resolves contention when several people want the same slots', () => {
    const contended = [slotId('mon', 0), slotId('mon', 1), slotId('tue', 0)];
    const spec: MeetingProblemSpec = {
      slots,
      people: [
        { id: 'ana', availableSlotIds: contended },
        { id: 'bo', availableSlotIds: contended },
        { id: 'cai', availableSlotIds: contended },
      ],
    };

    const result = solve(createMeetingProblem(spec), {
      seed: 3,
      populationSize: 80,
    });

    assert.equal(result.best.feasible, true);
    assertScheduleIsValid(spec, result.best.candidate);
  });

  test('reports the unsatisfied constraint when no schedule exists', () => {
    // Two people, one shared slot each — they must clash.
    const twoSlots = createDailySlots(['mon'], 2);
    const spec: MeetingProblemSpec = {
      slots: twoSlots,
      people: [
        { id: 'ana', availableSlotIds: ['mon#0'] },
        { id: 'bo', availableSlotIds: ['mon#0'] },
      ],
    };

    const result = solve(createMeetingProblem(spec), {
      seed: 4,
      populationSize: 30,
      maxGenerations: 40,
      stallGenerations: 10,
    });

    assert.equal(result.best.feasible, false);
    assert.notEqual(result.stopReason, 'target-reached');

    const violations = violatedConstraints(result.best);
    assert.deepEqual(
      violations.map((entry) => entry.id),
      ['no-double-booking'],
    );
  });

  test('honours the compact-days preference once feasibility is met', () => {
    const wideOpen = slots.map((slot) => slot.id);
    const spec: MeetingProblemSpec = {
      slots,
      people: [
        { id: 'ana', availableSlotIds: wideOpen },
        { id: 'bo', availableSlotIds: wideOpen },
        { id: 'cai', availableSlotIds: wideOpen },
      ],
      preferences: { compactDaysWeight: 1 },
    };

    const result = solve(createMeetingProblem(spec), {
      seed: 5,
      populationSize: 80,
      maxGenerations: 200,
    });

    assert.equal(result.best.feasible, true);
    assertScheduleIsValid(spec, result.best.candidate);

    // Three people, three slots per day — one day can hold them all.
    const schedule = describeSchedule(spec, result.best.candidate);
    assert.equal(
      schedule.days.length,
      1,
      `expected a single day, got ${schedule.days.join(', ')}`,
    );
  });

  test('honours the earliness preference', () => {
    const wideOpen = slots.map((slot) => slot.id);
    const spec: MeetingProblemSpec = {
      slots,
      people: [
        { id: 'ana', availableSlotIds: wideOpen },
        { id: 'bo', availableSlotIds: wideOpen },
      ],
      preferences: { earlinessWeight: 10 },
    };

    const result = solve(createMeetingProblem(spec), {
      seed: 6,
      populationSize: 80,
      maxGenerations: 200,
    });

    assert.equal(result.best.feasible, true);

    // The two earliest slots are indices 0 and 1.
    const schedule = describeSchedule(spec, result.best.candidate);
    assert.deepEqual(
      schedule.meetings
        .map((meeting) => meeting.slot.index)
        .sort((a, b) => a - b),
      [0, 1],
    );
  });

  test('availability is structurally satisfied, never merely optimised away', () => {
    // Availability is enforced by the encoding, not by the search: allowedValues
    // confines `create` and `mutate`, and uniform crossover copies each position
    // from a parent at the same position. So no operator can produce a candidate
    // that breaks availability, and the constraint should read zero for every
    // candidate the solver ever scores — including the intermediate ones.
    // Heavily contended, so the search genuinely runs generations rather than
    // stumbling onto a solution in the initial population.
    const spec: MeetingProblemSpec = { slots: bigSlots, people: bigRoster };

    const problem = createMeetingProblem(spec);
    const availability = problem.constraints.find(
      (entry) => entry.id === 'availability',
    );
    assert.ok(availability, 'the availability constraint should exist');

    let scored = 0;
    let worstAvailabilityViolation = 0;

    const observed = {
      ...problem,
      constraints: problem.constraints.map((constraint) =>
        constraint.id !== 'availability' ?
          constraint
        : {
            ...constraint,
            evaluate: (candidate: Assignment) => {
              const violation = constraint.evaluate(candidate);
              scored += 1;
              worstAvailabilityViolation = Math.max(
                worstAvailabilityViolation,
                violation,
              );
              return violation;
            },
          },
      ),
    };

    const result = solve(observed, {
      seed: 8,
      populationSize: 40,
      maxGenerations: 30,
    });

    assert.ok(scored > 100, `expected many evaluations, saw ${String(scored)}`);
    assert.equal(
      worstAvailabilityViolation,
      0,
      'no operator should ever produce an unavailable booking',
    );
    assert.equal(result.best.feasible, true);
  });

  test('availability does bite when the encoding is not confined', () => {
    // The constraint is not dead weight: swap in an unconfined encoding — what a
    // caller gets if they build the problem themselves — and it starts firing.
    const spec: MeetingProblemSpec = {
      slots,
      people: [
        { id: 'ana', availableSlotIds: [slotId('mon', 0)] },
        { id: 'bo', availableSlotIds: [slotId('tue', 1)] },
      ],
    };

    const problem = createMeetingProblem(spec);
    const availability = problem.constraints.find(
      (entry) => entry.id === 'availability',
    );
    assert.ok(availability);

    const unconfined = createAssignmentEncoding({
      domainSizes: [slots.length, slots.length],
    });
    const rng = createRng(9);
    let sawViolation = false;

    for (let draw = 0; draw < 200; draw += 1) {
      if (availability.evaluate(unconfined.create(rng)) > 0) {
        sawViolation = true;
        break;
      }
    }

    assert.ok(
      sawViolation,
      'an unconfined candidate should be able to break availability',
    );
  });

  test('local search closes conflicts that plain crossover and mutation cannot', () => {
    // A 60-person roster over 80 slots, proven feasible by construction below.
    // Without local search the search plateaus one booking short and reports
    // 'stalled'; with it, the same seed reaches a valid schedule. This is the
    // regression that justifies the repair step existing at all.
    const bigger = createDailySlots(
      Array.from({ length: 20 }, (_unused, day) => `d${String(day)}`),
      4,
    );
    const window = 10;
    const roster: Person[] = Array.from({ length: 60 }, (_unused, index) => {
      const start = index % (bigger.length - window + 1);
      return {
        id: `p${String(index)}`,
        availableSlotIds: bigger
          .filter((slot) => slot.index >= start && slot.index < start + window)
          .map((slot) => slot.id),
      };
    });
    const spec: MeetingProblemSpec = { slots: bigger, people: roster };
    const options = {
      seed: 3,
      populationSize: 60,
      maxGenerations: 300,
      stallGenerations: 60,
    };

    const withoutRepair = solve(createMeetingProblem(spec), {
      ...options,
      localSearchSteps: 0,
    });
    const withRepair = solve(createMeetingProblem(spec), {
      ...options,
      localSearchSteps: 8,
    });

    assert.equal(
      withoutRepair.best.feasible,
      false,
      'precondition: this instance defeats the plain search',
    );
    assert.equal(withRepair.best.feasible, true);
    assertScheduleIsValid(spec, withRepair.best.candidate);
  });

  test('repair never books somebody into a slot they cannot attend', () => {
    // The relocation move draws only from the person's allowed values, so the
    // encoding's availability guarantee has to survive local search too.
    const spec: MeetingProblemSpec = { slots: bigSlots, people: bigRoster };
    const problem = createMeetingProblem(spec);
    const availability = problem.constraints.find(
      (entry) => entry.id === 'availability',
    );
    assert.ok(availability);

    let worst = 0;
    let scored = 0;
    const observed = {
      ...problem,
      constraints: problem.constraints.map((constraint) =>
        constraint.id !== 'availability' ?
          constraint
        : {
            ...constraint,
            evaluate: (candidate: Assignment) => {
              const violation = constraint.evaluate(candidate);
              scored += 1;
              worst = Math.max(worst, violation);
              return violation;
            },
          },
      ),
    };

    solve(observed, {
      seed: 11,
      populationSize: 40,
      maxGenerations: 30,
      localSearchSteps: 6,
    });

    assert.ok(scored > 100, `expected many evaluations, saw ${String(scored)}`);
    assert.equal(worst, 0, 'local search must stay inside the allowed slots');
  });

  test('the exact solver settles instances the search cannot', () => {
    // 120 people over 120 slots — no spare capacity at all, so every clash has
    // to be resolved by a chain of relocations rather than a free slot. This is
    // the shape that defeats local search, and matching answers it outright.
    const tightSlots = createDailySlots(
      Array.from({ length: 30 }, (_unused, day) => `d${String(day)}`),
      4,
    );
    const window = 30;
    const roster: Person[] = Array.from({ length: 120 }, (_unused, index) => {
      const start = index % (tightSlots.length - window + 1);
      return {
        id: `p${String(index)}`,
        availableSlotIds: tightSlots
          .filter((slot) => slot.index >= start && slot.index < start + window)
          .map((slot) => slot.id),
      };
    });
    const spec: MeetingProblemSpec = { slots: tightSlots, people: roster };

    const exact = solveMeetingExactly(spec);

    assert.equal(exact.feasible, true);
    assert.ok(exact.assignment);
    assert.deepEqual(exact.unplaced, []);
    assertScheduleIsValid(spec, exact.assignment);

    const heuristic = solve(createMeetingProblem(spec), {
      seed: 1,
      populationSize: 60,
      maxGenerations: 120,
      stallGenerations: 40,
      localSearchSteps: 8,
    });

    assert.equal(
      heuristic.best.feasible,
      false,
      'precondition: the search does not finish this one, which is why exact exists',
    );
  });

  test('an impossible schedule comes back with a proof, not a shrug', () => {
    // Three people, two slots between them. No search budget could ever fix it,
    // and the useful answer names the group rather than just saying "no".
    const twoSlots = createDailySlots(['mon'], 2);
    const crowd = [slotId('mon', 0), slotId('mon', 1)];
    const spec: MeetingProblemSpec = {
      slots: twoSlots,
      people: [
        { id: 'ana', availableSlotIds: crowd },
        { id: 'bo', availableSlotIds: crowd },
      ],
    };

    // Two people, two slots: fine.
    assert.equal(solveMeetingExactly(spec).feasible, true);

    const crowded: MeetingProblemSpec = {
      slots: createDailySlots(['mon'], 3),
      people: [
        { id: 'ana', availableSlotIds: crowd },
        { id: 'bo', availableSlotIds: crowd },
        { id: 'cai', availableSlotIds: crowd },
      ],
    };
    const result = solveMeetingExactly(crowded);

    assert.equal(result.feasible, false);
    assert.equal(result.assignment, undefined);
    assert.equal(result.unplaced.length, 1);
    assert.ok(result.bottleneck);
    assert.deepEqual(
      result.bottleneck.people.map((person) => person.id),
      ['ana', 'bo', 'cai'],
    );
    assert.deepEqual(
      result.bottleneck.slots.map((slot) => slot.id),
      crowd,
    );
  });

  test('the exact result can seed the search to work on preferences', () => {
    // The handoff that makes both solvers worth having: matching supplies a
    // valid schedule, the search spends its whole budget on soft preferences
    // instead of rediscovering feasibility.
    const spec: MeetingProblemSpec = {
      slots: bigSlots,
      people: bigRoster,
      preferences: { earlinessWeight: 5 },
    };

    const exact = solveMeetingExactly(spec);
    assert.ok(exact.assignment);

    const options = {
      seed: 2,
      populationSize: 40,
      maxGenerations: 40,
      localSearchSteps: 4,
    };
    const warm = solve(createMeetingProblem(spec), {
      ...options,
      initialCandidates: [exact.assignment],
    });

    assert.equal(warm.best.feasible, true);
    assertScheduleIsValid(spec, warm.best.candidate);
    assert.ok(
      warm.best.softViolation <= exact.assignment.length,
      'seeding must not make the soft score absurd',
    );
  });

  test('scales to a larger roster', () => {
    const spec: MeetingProblemSpec = { slots: bigSlots, people: bigRoster };
    const result = solve(createMeetingProblem(spec), {
      seed: 7,
      populationSize: 200,
      maxGenerations: 600,
      stallGenerations: 200,
    });

    assert.equal(
      result.best.feasible,
      true,
      'a feasible schedule exists and should be found',
    );
    assertScheduleIsValid(spec, result.best.candidate);
  });
});

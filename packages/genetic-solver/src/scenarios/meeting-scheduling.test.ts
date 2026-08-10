import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { solve } from '../solver.ts';
import { violatedConstraints } from '../constraints.ts';
import {
  createDailySlots,
  createMeetingProblem,
  describeSchedule,
} from './meeting-scheduling.ts';
import type { MeetingProblemSpec, Person } from './meeting-scheduling.ts';

const days = ['mon', 'tue', 'wed'];
const slots = createDailySlots(days, 3);
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

  test('scales to a larger roster', () => {
    const bigSlots = createDailySlots(['mon', 'tue', 'wed', 'thu', 'fri'], 4);
    const people: Person[] = Array.from({ length: 18 }, (_unused, index) => {
      // Deterministic, uneven availability: each person can attend a narrow
      // window of 4 consecutive slots, and the windows overlap heavily, so
      // contention is real rather than incidental.
      const start = index % (bigSlots.length - 3);
      const available = bigSlots
        .filter((slot) => slot.index >= start && slot.index < start + 4)
        .map((slot) => slot.id);
      return { id: `p${String(index)}`, availableSlotIds: available };
    });

    const spec: MeetingProblemSpec = { slots: bigSlots, people };
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

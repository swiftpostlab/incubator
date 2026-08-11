import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { solve } from '../solver.ts';
import { createDailySlots } from './meeting-scheduling.ts';
import {
  createPlanProblem,
  describePlan,
  planIsExactlySolvable,
  solvePlan as solvePlanRouted,
  validatePlanSpec,
} from './meeting-plan.ts';
import type { MeetingPlanSpec } from './meeting-plan.ts';

const slots = createDailySlots(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], 3);
const lunchSlotIds = ['Mon#1', 'Tue#1', 'Wed#1', 'Thu#1', 'Fri#1'];
const lastDaySlotIds = ['Fri#0', 'Fri#1', 'Fri#2'];

/**
 * The scenario that motivated this model: a joint meeting, a pair who must not
 * meet together, a person who prefers being seen alone, a reserved slot, a
 * spacing rule, and a cross-person same-day ban.
 */
const richSpec: MeetingPlanSpec = {
  slots,
  needs: { X: 1, Y: 1, Z: 1, Q: 1, ana: 1, bo: 1, jerry: 2 },
  meetings: [
    { id: 'x-solo', attendees: ['X'] },
    { id: 'y-solo', attendees: ['Y'] },
    { id: 'z-solo', attendees: ['Z'] },
    { id: 'yz-joint', attendees: ['Y', 'Z'], allowedSlotIds: lunchSlotIds },
    { id: 'q-reserved', attendees: ['Q'], allowedSlotIds: lastDaySlotIds },
    { id: 'ana-solo', attendees: ['ana'] },
    { id: 'bo-solo', attendees: ['bo'] },
    { id: 'jerry-1', attendees: ['jerry'] },
    { id: 'jerry-2', attendees: ['jerry'] },
  ],
  rules: [
    { kind: 'spacing', person: 'jerry', minDays: 2 },
    { kind: 'not-same-day', people: ['ana', 'bo'] },
    { kind: 'avoid', meeting: 'yz-joint', weight: 5 },
  ],
};

const solvePlan = (spec: MeetingPlanSpec) =>
  solve(createPlanProblem(spec), {
    seed: 7,
    populationSize: 200,
    maxGenerations: 400,
    localSearchSteps: 30,
  });

const dayOf = (slotId: string) => slotId.split('#')[0];

describe('validatePlanSpec', () => {
  const valid: MeetingPlanSpec = {
    slots,
    needs: { ana: 1 },
    meetings: [{ id: 'a', attendees: ['ana'] }],
  };

  test('accepts a minimal plan', () => {
    assert.doesNotThrow(() => {
      validatePlanSpec(valid);
    });
  });

  test('rejects an empty slot or meeting list', () => {
    assert.throws(() => {
      validatePlanSpec({ ...valid, slots: [] });
    }, RangeError);
    assert.throws(() => {
      validatePlanSpec({ ...valid, meetings: [] });
    }, RangeError);
  });

  test('rejects duplicate meeting ids', () => {
    assert.throws(() => {
      validatePlanSpec({
        ...valid,
        meetings: [
          { id: 'a', attendees: ['ana'] },
          { id: 'a', attendees: ['ana'] },
        ],
      });
    }, RangeError);
  });

  test('rejects a meeting with no attendees or a repeated attendee', () => {
    assert.throws(() => {
      validatePlanSpec({ ...valid, meetings: [{ id: 'a', attendees: [] }] });
    }, RangeError);
    assert.throws(() => {
      validatePlanSpec({
        ...valid,
        meetings: [{ id: 'a', attendees: ['ana', 'ana'] }],
      });
    }, RangeError);
  });

  test('rejects an attendee with no entry in needs', () => {
    assert.throws(() => {
      validatePlanSpec({
        ...valid,
        meetings: [{ id: 'a', attendees: ['nobody'] }],
      });
    }, RangeError);
  });

  test('rejects an unknown slot id', () => {
    assert.throws(() => {
      validatePlanSpec({
        ...valid,
        meetings: [{ id: 'a', attendees: ['ana'], allowedSlotIds: ['zzz'] }],
      });
    }, RangeError);
  });

  test('rejects needing more meetings than were declared', () => {
    assert.throws(() => {
      validatePlanSpec({ ...valid, needs: { ana: 2 } });
    }, RangeError);
  });

  test('rejects a rule naming an unknown person or meeting', () => {
    assert.throws(() => {
      validatePlanSpec({
        ...valid,
        rules: [{ kind: 'spacing', person: 'ghost', minDays: 1 }],
      });
    }, RangeError);
    assert.throws(() => {
      validatePlanSpec({
        ...valid,
        rules: [{ kind: 'avoid', meeting: 'ghost' }],
      });
    }, RangeError);
  });

  test('rejects a slot capacity below one', () => {
    assert.throws(() => {
      validatePlanSpec({ ...valid, slotCapacity: 0 });
    }, RangeError);
  });
});

describe('planIsExactlySolvable', () => {
  const singleton: MeetingPlanSpec = {
    slots,
    needs: { ana: 1, bo: 1 },
    meetings: [
      { id: 'a', attendees: ['ana'] },
      { id: 'b', attendees: ['bo'] },
    ],
  };

  test('accepts one-to-one plans, which are still bipartite matching', () => {
    assert.equal(planIsExactlySolvable(singleton), true);
  });

  test('tolerates soft rules, which do not affect feasibility', () => {
    assert.equal(
      planIsExactlySolvable({
        ...singleton,
        rules: [{ kind: 'avoid', meeting: 'a', weight: 2 }],
      }),
      true,
    );
  });

  test('rejects a multi-attendee meeting', () => {
    assert.equal(
      planIsExactlySolvable({
        ...singleton,
        meetings: [{ id: 'a', attendees: ['ana', 'bo'] }],
        needs: { ana: 1, bo: 1 },
      }),
      false,
    );
  });

  test('rejects capacity above one', () => {
    assert.equal(
      planIsExactlySolvable({ ...singleton, slotCapacity: 2 }),
      false,
    );
  });

  test('rejects a hard rule, which matching scores independently', () => {
    assert.equal(
      planIsExactlySolvable({
        ...singleton,
        rules: [{ kind: 'not-same-day', people: ['ana', 'bo'] }],
      }),
      false,
    );
  });

  test('rejects a choice between alternative meetings', () => {
    // ana has two declared meetings but needs one, so *which* one happens is a
    // decision. Matching cannot make it.
    assert.equal(
      planIsExactlySolvable({
        slots,
        needs: { ana: 1 },
        meetings: [
          { id: 'a1', attendees: ['ana'] },
          { id: 'a2', attendees: ['ana'] },
        ],
      }),
      false,
    );
  });
});

describe('createPlanProblem on the motivating scenario', () => {
  test('finds a feasible plan and prefers the solo meeting', () => {
    const result = solvePlan(richSpec);

    assert.equal(result.best.feasible, true);
    assert.equal(result.best.softViolation, 0, 'the joint meeting was used');

    const { scheduled, dropped } = describePlan(
      richSpec,
      result.best.candidate,
    );
    const ids = scheduled.map((entry) => entry.meeting.id);

    assert.ok(ids.includes('z-solo'));
    assert.ok(!ids.includes('yz-joint'));
    assert.deepEqual(
      dropped.map((meeting) => meeting.id),
      ['yz-joint'],
    );
  });

  test('honours every hard rule in the plan it returns', () => {
    const result = solvePlan(richSpec);
    const { scheduled } = describePlan(richSpec, result.best.candidate);

    const slotIdsUsed = scheduled.map((entry) => entry.slot.id);
    assert.equal(
      new Set(slotIdsUsed).size,
      slotIdsUsed.length,
      'two meetings shared a slot',
    );

    const daysFor = (person: string) =>
      scheduled
        .filter((entry) => entry.meeting.attendees.includes(person))
        .map((entry) => slots.findIndex((slot) => slot.id === entry.slot.id))
        .map((slotIndex) => Math.floor(slotIndex / 3));

    const jerryDays = daysFor('jerry').sort((left, right) => left - right);
    assert.equal(jerryDays.length, 2);
    assert.ok(
      jerryDays[1] - jerryDays[0] >= 2,
      `jerry's meetings were ${String(jerryDays[1] - jerryDays[0])} day(s) apart`,
    );

    assert.notDeepEqual(daysFor('ana'), daysFor('bo'));

    const reserved = scheduled.find(
      (entry) => entry.meeting.id === 'q-reserved',
    );
    assert.ok(reserved);
    assert.equal(dayOf(reserved.slot.id), 'Fri');
  });

  test('falls back to the joint meeting when the solo one cannot be placed', () => {
    // X can only take Mon#0 and has no alternative; Z's solo option is the same
    // single slot. Z must therefore accept the less-preferred joint meeting.
    const blocked: MeetingPlanSpec = {
      ...richSpec,
      meetings: richSpec.meetings.map((meeting) => {
        if (meeting.id === 'x-solo' || meeting.id === 'z-solo') {
          return { ...meeting, allowedSlotIds: ['Mon#0'] };
        }
        return meeting;
      }),
    };

    const result = solvePlan(blocked);
    assert.equal(result.best.feasible, true);

    const { scheduled } = describePlan(blocked, result.best.candidate);
    const ids = scheduled.map((entry) => entry.meeting.id);

    assert.ok(ids.includes('yz-joint'), 'the joint meeting was not used');
    assert.ok(!ids.includes('z-solo'));
    assert.ok(!ids.includes('y-solo'), 'Y was scheduled twice');

    const joint = scheduled.find((entry) => entry.meeting.id === 'yz-joint');
    assert.ok(joint);
    assert.ok(
      lunchSlotIds.includes(joint.slot.id),
      'the joint meeting was not at lunch',
    );
  });

  test('is deterministic for a given seed', () => {
    assert.deepEqual(
      solvePlan(richSpec).best.candidate,
      solvePlan(richSpec).best.candidate,
    );
  });
});

describe('solvePlan routing and certainty', () => {
  const oneToOne: MeetingPlanSpec = {
    slots,
    needs: { ana: 1, bo: 1 },
    meetings: [
      { id: 'a', attendees: ['ana'] },
      { id: 'b', attendees: ['bo'] },
    ],
  };

  test('takes the exact route for a one-to-one plan', () => {
    const outcome = solvePlanRouted(oneToOne);

    assert.equal(outcome.scheduled, true);
    assert.equal(outcome.method, 'exact');
    assert.equal(outcome.certainty, 'proof');
  });

  test('proves impossibility when the exact route applies', () => {
    const impossible: MeetingPlanSpec = {
      slots,
      needs: { ana: 1, bo: 1 },
      meetings: [
        { id: 'a', attendees: ['ana'], allowedSlotIds: ['Mon#0'] },
        { id: 'b', attendees: ['bo'], allowedSlotIds: ['Mon#0'] },
      ],
    };

    const outcome = solvePlanRouted(impossible);

    assert.equal(outcome.scheduled, false);
    assert.equal(outcome.method, 'exact');
    assert.equal(outcome.certainty, 'proof');
    assert.deepEqual([...(outcome.bottleneck?.slots ?? [])], ['Mon#0']);
    assert.equal(outcome.bottleneck?.meetings.length, 2);
  });

  test('refines from the exact answer when a soft rule is present', () => {
    const outcome = solvePlanRouted({
      ...oneToOne,
      rules: [{ kind: 'avoid', meeting: 'a', weight: 1 }],
    });

    // 'a' must still happen — ana needs one meeting and only 'a' provides it —
    // so the avoid rule cannot be satisfied. The point is the route taken.
    assert.equal(outcome.scheduled, true);
    assert.equal(outcome.method, 'exact+genetic');
  });

  test('searches when the plan leaves the matching class', () => {
    const outcome = solvePlanRouted(richSpec);

    assert.equal(outcome.scheduled, true);
    assert.equal(outcome.method, 'genetic');
    assert.equal(outcome.certainty, 'proof');
  });

  test('never reports a failed search as a proof', () => {
    // Two people banned from sharing a day, but only one day exists. The plan
    // is genuinely impossible, and it is outside the matching class — so the
    // honest answer is "did not find one", not "none exists".
    const outcome = solvePlanRouted(
      {
        slots: createDailySlots(['Mon'], 3),
        needs: { ana: 1, bo: 1 },
        meetings: [
          { id: 'a', attendees: ['ana'] },
          { id: 'b', attendees: ['bo'] },
        ],
        rules: [{ kind: 'not-same-day', people: ['ana', 'bo'] }],
      },
      { maxGenerations: 40, populationSize: 40 },
    );

    assert.equal(outcome.scheduled, false);
    assert.equal(outcome.method, 'genetic');
    assert.equal(
      outcome.certainty,
      'not-found',
      'an unsolved search was reported as a proof',
    );
    assert.equal(outcome.bottleneck, undefined);
  });

  test('is deterministic for a given seed', () => {
    assert.deepEqual(
      solvePlanRouted(richSpec, { seed: 3 }).candidate,
      solvePlanRouted(richSpec, { seed: 3 }).candidate,
    );
  });
});

describe('describePlan', () => {
  test('reports scheduled meetings in slot order and names the dropped ones', () => {
    const spec: MeetingPlanSpec = {
      slots,
      needs: { ana: 1 },
      meetings: [
        { id: 'late', attendees: ['ana'], allowedSlotIds: ['Tue#0'] },
        { id: 'early', attendees: ['ana'], allowedSlotIds: ['Mon#0'] },
      ],
    };

    // Schedule only "early"; "late" takes the unscheduled sentinel.
    const description = describePlan(spec, [slots.length, 0]);

    assert.deepEqual(
      description.scheduled.map((entry) => entry.meeting.id),
      ['early'],
    );
    assert.deepEqual(
      description.dropped.map((meeting) => meeting.id),
      ['late'],
    );
    assert.deepEqual(description.days, ['Mon']);
  });
});

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

/**
 * Group meetings need no feature of their own — they fall out of attendee sets
 * plus `avoid`. These pin that, because the next few rules are built on the
 * assumption and would hide a regression in it.
 */
describe('meeting people as a group', () => {
  const people = ['ana', 'bo', 'cy', 'dee', 'eli', 'fay', 'gus'];

  const groupSpec = (
    days: readonly string[],
    slotsPerDay: number,
  ): MeetingPlanSpec => ({
    slots: createDailySlots(days, slotsPerDay),
    needs: Object.fromEntries(people.map((person) => [person, 1])),
    meetings: [
      // ana/bo/cy are meetable as one entity, or individually.
      { id: 'group-abc', attendees: ['ana', 'bo', 'cy'] },
      { id: 'ana', attendees: ['ana'] },
      { id: 'bo', attendees: ['bo'] },
      { id: 'cy', attendees: ['cy'] },
      // dee/eli can be met jointly, but it is worth less than meeting each.
      { id: 'group-de', attendees: ['dee', 'eli'] },
      { id: 'dee', attendees: ['dee'] },
      { id: 'eli', attendees: ['eli'] },
      // fay/gus cannot be met together, so no joint meeting is declared.
      { id: 'fay', attendees: ['fay'] },
      { id: 'gus', attendees: ['gus'] },
    ],
    rules: [{ kind: 'avoid', meeting: 'group-de', weight: 3 }],
  });

  const outcomeOf = (spec: MeetingPlanSpec) => {
    const outcome = solvePlanRouted(spec, { seed: 3, maxGenerations: 800 });

    assert.equal(outcome.scheduled, true);

    return {
      outcome,
      ids: new Set(
        describePlan(spec, outcome.candidate ?? []).scheduled.map(
          (entry) => entry.meeting.id,
        ),
      ),
    };
  };

  test('a joint meeting settles every attendee at once', () => {
    // Six slots cannot hold seven individual meetings, so the group has to be
    // used — and using it must satisfy ana, bo, and cy together.
    const { ids, outcome } = outcomeOf(groupSpec(['mon', 'tue'], 3));

    assert.equal(ids.has('group-abc'), true);
    assert.equal(ids.has('ana'), false);
    assert.equal(ids.has('bo'), false);
    assert.equal(ids.has('cy'), false);
    assert.equal(outcome.softViolation, 0);
  });

  test('an undiscounted group is still left alone when there is room', () => {
    const { ids, outcome } = outcomeOf(groupSpec(['mon', 'tue', 'wed'], 3));

    assert.equal(ids.has('group-abc'), false);
    assert.equal(ids.has('group-de'), false);
    assert.equal(ids.size, people.length);
    assert.equal(outcome.softViolation, 0);
  });

  test('a discounted group is used only under pressure, and costs its weight', () => {
    const { ids, outcome } = outcomeOf(groupSpec(['mon', 'tue'], 2));

    assert.equal(ids.has('group-de'), true);
    assert.equal(outcome.softViolation, 3);
  });

  test('people who cannot be met together never are', () => {
    for (const grid of [
      ['mon', 'tue', 'wed'],
      ['mon', 'tue'],
    ]) {
      const spec = groupSpec(grid, grid.length === 3 ? 3 : 2);
      const { outcome } = outcomeOf(spec);

      for (const { meeting } of describePlan(spec, outcome.candidate ?? [])
        .scheduled) {
        assert.equal(
          meeting.attendees.includes('fay') &&
            meeting.attendees.includes('gus'),
          false,
        );
      }
    }
  });
});

/**
 * Until a soft per-person preference exists, "prefer these slots" is said with
 * competing meetings and `avoid`. Pinned so the rule that replaces it has to
 * reproduce the same behaviour rather than merely look similar.
 */
describe('a soft preference expressed as competing meetings', () => {
  const preferred = ['Mon#0', 'Mon#1', 'Mon#2'];

  const spec = (blocked: readonly string[]): MeetingPlanSpec => ({
    slots,
    needs: {
      alex: 1,
      ...Object.fromEntries(blocked.map((slotId) => [`hog-${slotId}`, 1])),
    },
    meetings: [
      { id: 'alex-preferred', attendees: ['alex'], allowedSlotIds: preferred },
      { id: 'alex-fallback', attendees: ['alex'] },
      ...blocked.map((slotId) => ({
        id: `hog-${slotId}`,
        attendees: [`hog-${slotId}`],
        allowedSlotIds: [slotId],
      })),
    ],
    rules: [{ kind: 'avoid', meeting: 'alex-fallback', weight: 2 }],
  });

  test('takes the preferred slots when they are free, at no cost', () => {
    const free = spec([]);
    const outcome = solvePlanRouted(free, { seed: 3 });
    const scheduled = describePlan(free, outcome.candidate ?? []).scheduled;

    assert.equal(scheduled[0].meeting.id, 'alex-preferred');
    assert.equal(outcome.softViolation, 0);
  });

  test('falls back when they are taken, paying exactly the weight', () => {
    const squeezed = spec(preferred);
    const outcome = solvePlanRouted(squeezed, { seed: 3 });
    const ids = describePlan(squeezed, outcome.candidate ?? []).scheduled.map(
      (entry) => entry.meeting.id,
    );

    assert.equal(ids.includes('alex-fallback'), true);
    assert.equal(outcome.softViolation, 2);
  });
});

/**
 * The same preference, said once as a rule. The behaviour has to match the
 * workaround above — preferred slots when they are free, the stated weight when
 * they are not — or the rule is not a replacement for it.
 */
describe('a soft preference said once, as a prefer rule', () => {
  const preferred = ['Mon#0', 'Mon#1', 'Mon#2'];

  const spec = (blocked: readonly string[]): MeetingPlanSpec => ({
    slots,
    needs: {
      alex: 1,
      kia: 1,
      ...Object.fromEntries(blocked.map((slotId) => [`hog-${slotId}`, 1])),
    },
    meetings: [
      { id: 'alex', attendees: ['alex'] },
      { id: 'kia', attendees: ['kia'] },
      ...blocked.map((slotId) => ({
        id: `hog-${slotId}`,
        attendees: [`hog-${slotId}`],
        allowedSlotIds: [slotId],
      })),
    ],
    rules: [{ kind: 'prefer', person: 'alex', slotIds: preferred, weight: 2 }],
  });

  const slotFor = (plan: MeetingPlanSpec, person: string) => {
    const outcome = solvePlanRouted(plan, { seed: 3 });

    assert.equal(outcome.scheduled, true);

    return {
      outcome,
      slotId: describePlan(plan, outcome.candidate ?? []).scheduled.find(
        (entry) => entry.meeting.id === person,
      )?.slot.id,
    };
  };

  test('is soft, so the plan keeps its exact route', () => {
    const free = spec([]);

    assert.equal(planIsExactlySolvable(free), true);
    assert.equal(solvePlanRouted(free, { seed: 3 }).method, 'exact+genetic');
  });

  test('takes a preferred slot when one is free, at no cost', () => {
    const free = spec([]);
    const { outcome, slotId } = slotFor(free, 'alex');

    assert.ok(slotId !== undefined && preferred.includes(slotId), slotId);
    assert.equal(outcome.softViolation, 0);
  });

  test('gives way when the preferred slots are taken, paying the weight', () => {
    const squeezed = spec(preferred);
    const { outcome, slotId } = slotFor(squeezed, 'alex');

    assert.ok(slotId !== undefined && !preferred.includes(slotId), slotId);
    assert.equal(outcome.softViolation, 2);
  });

  test('binds one person, not the whole plan', () => {
    // kia has no rule, so kia sitting outside Monday is free. Only alex's
    // displacement is charged, and it is charged once.
    const squeezed = spec(preferred);
    const { outcome, slotId } = slotFor(squeezed, 'kia');

    assert.ok(slotId !== undefined && !preferred.includes(slotId), slotId);
    assert.equal(outcome.softViolation, 2);
  });

  test('charges the weight once per displaced meeting', () => {
    const twice: MeetingPlanSpec = {
      slots,
      needs: { alex: 2 },
      meetings: [
        { id: 'a1', attendees: ['alex'], allowedSlotIds: ['Tue#0'] },
        { id: 'a2', attendees: ['alex'], allowedSlotIds: ['Wed#0'] },
      ],
      rules: [
        { kind: 'prefer', person: 'alex', slotIds: preferred, weight: 2 },
      ],
    };

    assert.equal(solvePlanRouted(twice, { seed: 3 }).softViolation, 4);
  });

  test('rejects a rule naming an unknown person, slot, or nothing at all', () => {
    const base = spec([]);

    assert.throws(() => {
      validatePlanSpec({
        ...base,
        rules: [{ kind: 'prefer', person: 'ghost', slotIds: preferred }],
      });
    }, RangeError);
    assert.throws(() => {
      validatePlanSpec({
        ...base,
        rules: [{ kind: 'prefer', person: 'alex', slotIds: ['zzz'] }],
      });
    }, RangeError);
    assert.throws(() => {
      validatePlanSpec({
        ...base,
        rules: [{ kind: 'prefer', person: 'alex', slotIds: [] }],
      });
    }, RangeError);
  });
});

/**
 * The dinner-at-home case: the meal takes the slot after the one spent cooking,
 * and the cooking exists only because the meal does. Neither half is sayable
 * with the rules that came before — `spacing` is a minimum in days with no
 * ordering, and `needs` is exact equality, so it makes a meeting compulsory or
 * impossible but never conditional.
 */
describe('coupling two meetings with together and consecutive', () => {
  const twoDays = createDailySlots(['mon', 'tue'], 3);

  const dinner = (
    rules: MeetingPlanSpec['rules'],
    needs = 2,
  ): MeetingPlanSpec => ({
    slots: twoDays,
    needs: { john: needs },
    meetings: [
      { id: 'prep', attendees: ['john'] },
      { id: 'dinner-home', attendees: ['john'] },
    ],
    rules,
  });

  const placed = (spec: MeetingPlanSpec) => {
    const outcome = solvePlanRouted(spec, { seed: 5 });

    assert.equal(outcome.scheduled, true);

    const { scheduled } = describePlan(spec, outcome.candidate ?? []);

    return new Map(
      scheduled.map((entry) => [entry.meeting.id, entry.slot] as const),
    );
  };

  test('places the first meeting in the slot right before the second', () => {
    const slotsUsed = placed(
      dinner([{ kind: 'consecutive', first: 'prep', second: 'dinner-home' }]),
    );

    const prep = slotsUsed.get('prep');
    const meal = slotsUsed.get('dinner-home');

    assert.ok(prep && meal);
    assert.equal(meal.index - prep.index, 1);
    assert.equal(prep.day, meal.day);
  });

  test('honours a wider gap', () => {
    const slotsUsed = placed(
      dinner([
        { kind: 'consecutive', first: 'prep', second: 'dinner-home', gap: 2 },
      ]),
    );

    const prep = slotsUsed.get('prep');
    const meal = slotsUsed.get('dinner-home');

    assert.ok(prep && meal);
    assert.equal(meal.index - prep.index, 2);
    assert.equal(prep.day, meal.day);
  });

  test('will not straddle a day boundary, adjacent indices or not', () => {
    // mon#2 and tue#0 are one index apart and still not consecutive: cooking on
    // Monday night for Tuesday's dinner is not what was asked for.
    const acrossMidnight: MeetingPlanSpec = {
      ...dinner([
        { kind: 'consecutive', first: 'prep', second: 'dinner-home' },
      ]),
      meetings: [
        { id: 'prep', attendees: ['john'], allowedSlotIds: ['mon#2'] },
        { id: 'dinner-home', attendees: ['john'], allowedSlotIds: ['tue#0'] },
      ],
    };

    const outcome = solvePlanRouted(acrossMidnight, {
      seed: 5,
      populationSize: 40,
      maxGenerations: 40,
    });

    assert.equal(outcome.scheduled, false);
    assert.equal(outcome.certainty, 'not-found');
  });

  test('says nothing about whether either meeting happens', () => {
    // Only the ordering rule, and john needs one meeting rather than two. A
    // lone meeting satisfies consecutive, which is together's job to prevent.
    const single = dinner(
      [{ kind: 'consecutive', first: 'prep', second: 'dinner-home' }],
      1,
    );

    assert.equal(placed(single).size, 1);
  });

  test('together makes the pair all-or-nothing', () => {
    // john needs one meeting, so the pair cannot both happen — and together
    // forbids either happening alone. The only way out is the third option.
    const withAlternative: MeetingPlanSpec = {
      slots: twoDays,
      needs: { john: 1 },
      meetings: [
        { id: 'prep', attendees: ['john'] },
        { id: 'dinner-home', attendees: ['john'] },
        { id: 'dinner-out', attendees: ['john'] },
      ],
      rules: [
        { kind: 'together', meetings: ['prep', 'dinner-home'] },
        { kind: 'consecutive', first: 'prep', second: 'dinner-home' },
      ],
    };

    assert.deepEqual([...placed(withAlternative).keys()], ['dinner-out']);
  });

  test('both rules are hard, so the plan gives up its proof', () => {
    assert.equal(
      planIsExactlySolvable(
        dinner([{ kind: 'together', meetings: ['prep', 'dinner-home'] }]),
      ),
      false,
    );
    assert.equal(
      planIsExactlySolvable(
        dinner([{ kind: 'consecutive', first: 'prep', second: 'dinner-home' }]),
      ),
      false,
    );
  });

  test('rejects a rule that names an unknown or impossible pairing', () => {
    for (const rules of [
      [{ kind: 'together' as const, meetings: ['prep'] }],
      [{ kind: 'together' as const, meetings: ['prep', 'ghost'] }],
      [{ kind: 'consecutive' as const, first: 'prep', second: 'ghost' }],
      [{ kind: 'consecutive' as const, first: 'prep', second: 'prep' }],
      [
        {
          kind: 'consecutive' as const,
          first: 'prep',
          second: 'dinner-home',
          gap: 0,
        },
      ],
    ]) {
      assert.throws(() => {
        validatePlanSpec(dinner(rules));
      }, RangeError);
    }
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

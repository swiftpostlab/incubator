import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { InputError, parseSpec, run, solveRequest } from './meeting-request.ts';

const rosterSpec = {
  days: ['mon', 'tue'],
  slotsPerDay: 3,
  people: [
    { id: 'ana', availableSlotIds: ['mon#0', 'mon#1'] },
    { id: 'bo', availableSlotIds: ['mon#1', 'tue#0'] },
    { id: 'cy', availableSlotIds: ['tue#0', 'tue#2'] },
  ],
};

const scheduledIds = (result: ReturnType<typeof run>) =>
  (result.plan?.scheduled ?? []).map((entry) => entry.meeting.id);

describe('parseSpec shape validation', () => {
  test('rejects anything that is not an object', () => {
    assert.throws(() => parseSpec([]), InputError);
    assert.throws(() => parseSpec('spec'), InputError);
    assert.throws(() => parseSpec(null), InputError);
  });

  test('rejects a spec with neither people nor meetings', () => {
    assert.throws(
      () => parseSpec({ days: ['mon'], slotsPerDay: 2 }),
      InputError,
    );
  });

  test('rejects a malformed person', () => {
    assert.throws(
      () => parseSpec({ days: ['mon'], slotsPerDay: 2, people: [{}] }),
      InputError,
    );
    assert.throws(
      () =>
        parseSpec({
          days: ['mon'],
          slotsPerDay: 2,
          people: [{ id: 'ana', availableSlotIds: [7] }],
        }),
      InputError,
    );
  });

  test('rejects a grid described by neither slots nor days', () => {
    assert.throws(() => parseSpec({ people: [] }), InputError);
  });

  test('builds the slot grid from days and slotsPerDay', () => {
    const spec = parseSpec(rosterSpec);

    assert.deepEqual(
      spec.slots.map((slot) => slot.id),
      ['mon#0', 'mon#1', 'mon#2', 'tue#0', 'tue#1', 'tue#2'],
    );
  });

  test('leaves semantic errors to the plan, so the rules live in one place', () => {
    // Shape is fine; the slot id is not one the grid defines. parseSpec must
    // not catch that itself, or the two validators can drift apart.
    const spec = parseSpec({
      days: ['mon'],
      slotsPerDay: 2,
      people: [{ id: 'ana', availableSlotIds: ['nope#9'] }],
    });

    assert.throws(() => run(spec), RangeError);
  });
});

describe('parseSpec on the roster shape', () => {
  test('turns each person into a one-attendee meeting needing one slot', () => {
    const spec = parseSpec(rosterSpec);

    assert.equal(spec.meetings.length, 3);
    assert.deepEqual(
      spec.meetings.map((meeting) => meeting.attendees),
      [['ana'], ['bo'], ['cy']],
    );
    assert.deepEqual(spec.needs, { ana: 1, bo: 1, cy: 1 });
  });

  test('converts preferences into soft rules, and omits them at zero', () => {
    const withPreferences = parseSpec({
      ...rosterSpec,
      preferences: { compactDaysWeight: 2, earlinessWeight: 0 },
    });

    assert.deepEqual(withPreferences.rules, [
      { kind: 'compact-days', weight: 2 },
    ]);

    assert.deepEqual(parseSpec(rosterSpec).rules, []);
  });
});

describe('parseSpec on the plan shape', () => {
  const planSpec = {
    days: ['mon', 'tue'],
    slotsPerDay: 3,
    needs: { ana: 1, bo: 1 },
    meetings: [
      { id: 'joint', attendees: ['ana', 'bo'], allowedSlotIds: ['mon#1'] },
    ],
  };

  test('keeps attendees, needs, and rules as given', () => {
    const spec = parseSpec({
      ...planSpec,
      rules: [{ kind: 'not-same-day', people: ['ana', 'bo'] }],
    });

    assert.deepEqual(spec.meetings[0].attendees, ['ana', 'bo']);
    assert.deepEqual(spec.needs, { ana: 1, bo: 1 });
    assert.equal(spec.rules?.length, 1);
  });

  test('rejects a plan without needs', () => {
    const { needs: _needs, ...withoutNeeds } = planSpec;
    assert.throws(() => parseSpec(withoutNeeds), InputError);
  });

  test('rejects a malformed meeting', () => {
    assert.throws(
      () => parseSpec({ ...planSpec, meetings: [{ id: 'a' }] }),
      InputError,
    );
    assert.throws(
      () =>
        parseSpec({
          ...planSpec,
          meetings: [{ id: 'a', attendees: [7] }],
        }),
      InputError,
    );
  });

  test('rejects non-array rules', () => {
    assert.throws(() => parseSpec({ ...planSpec, rules: 'none' }), InputError);
  });
});

describe('run routing', () => {
  test('takes the exact route for a plain roster', () => {
    const result = run(parseSpec(rosterSpec));

    assert.equal(result.outcome.scheduled, true);
    assert.equal(result.outcome.method, 'exact');
    assert.equal(result.outcome.certainty, 'proof');
    assert.equal(result.plan?.scheduled.length, 3);
    assert.deepEqual(result.plan?.dropped, []);
  });

  test('adds the genetic pass once a preference carries weight', () => {
    const result = run(
      parseSpec({ ...rosterSpec, preferences: { compactDaysWeight: 1 } }),
    );

    assert.equal(result.outcome.scheduled, true);
    assert.equal(result.outcome.method, 'exact+genetic');
    assert.ok(result.outcome.softViolation !== undefined);
  });

  test('treats zero-weight preferences as no preferences', () => {
    const result = run(
      parseSpec({
        ...rosterSpec,
        preferences: { compactDaysWeight: 0, earlinessWeight: 0 },
      }),
    );

    assert.equal(result.outcome.method, 'exact');
  });

  test('proves a roster impossible rather than searching for it', () => {
    const result = run(
      parseSpec({
        days: ['mon'],
        slotsPerDay: 3,
        people: [
          { id: 'ana', availableSlotIds: ['mon#0'] },
          { id: 'bo', availableSlotIds: ['mon#0'] },
          { id: 'cy', availableSlotIds: ['mon#0'] },
        ],
      }),
    );

    assert.equal(result.outcome.scheduled, false);
    assert.equal(result.outcome.method, 'exact');
    assert.equal(result.outcome.certainty, 'proof');
    assert.deepEqual([...(result.outcome.bottleneck?.slots ?? [])], ['mon#0']);
  });

  test('never double-books a slot', () => {
    const result = run(parseSpec(rosterSpec));
    const used = (result.plan?.scheduled ?? []).map((entry) => entry.slot.id);

    assert.equal(new Set(used).size, used.length);
  });

  test('is deterministic for a given seed', () => {
    const spec = parseSpec({
      ...rosterSpec,
      preferences: { compactDaysWeight: 1 },
    });

    assert.deepEqual(
      run(spec, { seed: 3 }).outcome.candidate,
      run(spec, { seed: 3 }).outcome.candidate,
    );
  });
});

describe('solveRequest', () => {
  test('parses and solves raw text in one step', () => {
    const result = solveRequest(JSON.stringify(rosterSpec));

    assert.equal(result.outcome.scheduled, true);
    assert.equal(scheduledIds(result).length, 3);
  });

  test('reports invalid JSON as an InputError', () => {
    assert.throws(() => solveRequest('not json'), InputError);
  });

  test('solves a plan with a joint meeting and an avoid rule', () => {
    const result = solveRequest(
      JSON.stringify({
        days: ['mon', 'tue'],
        slotsPerDay: 3,
        needs: { ana: 1, bo: 1 },
        meetings: [
          { id: 'ana-solo', attendees: ['ana'] },
          { id: 'bo-solo', attendees: ['bo'] },
          { id: 'joint', attendees: ['ana', 'bo'], allowedSlotIds: ['mon#1'] },
        ],
        rules: [{ kind: 'avoid', meeting: 'joint', weight: 5 }],
      }),
    );

    assert.equal(result.outcome.scheduled, true);
    // Both solo meetings satisfy the needs without paying the avoid penalty.
    assert.ok(!scheduledIds(result).includes('joint'));
    assert.equal(result.outcome.softViolation, 0);
  });
});

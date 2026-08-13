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

describe('availability rules compile into slot lists', () => {
  const week = {
    days: ['mon', 'tue', 'wed'],
    slotsPerDay: 3,
    people: [{ id: 'sally' }],
  };

  const allowedFor = (spec: ReturnType<typeof parseSpec>, meetingId: string) =>
    spec.meetings.find((meeting) => meeting.id === meetingId)?.allowedSlotIds;

  test('a person with no rules and no slot list is free all week', () => {
    const spec = parseSpec(week);

    assert.equal(allowedFor(spec, 'sally'), undefined);
  });

  test('busy by day removes that whole day, and nothing else', () => {
    const spec = parseSpec({
      ...week,
      availability: [{ kind: 'busy', person: 'sally', days: ['tue'] }],
    });

    assert.deepEqual(allowedFor(spec, 'sally'), [
      'mon#0',
      'mon#1',
      'mon#2',
      'wed#0',
      'wed#1',
      'wed#2',
    ]);
  });

  test('busy by slotOfDay removes that position on every day', () => {
    const spec = parseSpec({
      ...week,
      availability: [{ kind: 'busy', person: 'sally', slotOfDay: [1] }],
    });

    assert.deepEqual(allowedFor(spec, 'sally'), [
      'mon#0',
      'mon#2',
      'tue#0',
      'tue#2',
      'wed#0',
      'wed#2',
    ]);
  });

  test('slotOfDay counts within the day, not by the whole-grid index', () => {
    // Slot.index is a grid-wide ordinal, so position 1 of each day is index 1,
    // 4, and 7 here. A rule reading Slot.index directly would remove one slot.
    const spec = parseSpec({
      ...week,
      availability: [{ kind: 'busy', person: 'sally', slotOfDay: [1] }],
    });

    assert.equal(allowedFor(spec, 'sally')?.length, 6);
  });

  test('slotOfDay orders by index, not by the order slots were listed', () => {
    const spec = parseSpec({
      slots: [
        { id: 'late', day: 'mon', index: 2 },
        { id: 'early', day: 'mon', index: 0 },
        { id: 'middle', day: 'mon', index: 1 },
      ],
      people: [{ id: 'sally' }],
      availability: [{ kind: 'busy', person: 'sally', slotOfDay: [0] }],
    });

    assert.deepEqual(allowedFor(spec, 'sally'), ['late', 'middle']);
  });

  test('selectors within one rule are ANDed, so this is Wednesday lunch', () => {
    const spec = parseSpec({
      ...week,
      availability: [
        { kind: 'busy', person: 'sally', days: ['wed'], slotOfDay: [1] },
      ],
    });

    assert.deepEqual(allowedFor(spec, 'sally'), [
      'mon#0',
      'mon#1',
      'mon#2',
      'tue#0',
      'tue#1',
      'tue#2',
      'wed#0',
      'wed#2',
    ]);
  });

  test('free keeps only the matched slots', () => {
    const spec = parseSpec({
      ...week,
      availability: [{ kind: 'free', person: 'sally', days: ['wed'] }],
    });

    assert.deepEqual(allowedFor(spec, 'sally'), ['wed#0', 'wed#1', 'wed#2']);
  });

  test("a person's free rules union rather than intersect", () => {
    const spec = parseSpec({
      ...week,
      availability: [
        { kind: 'free', person: 'sally', days: ['mon'] },
        { kind: 'free', person: 'sally', days: ['wed'] },
      ],
    });

    assert.deepEqual(allowedFor(spec, 'sally'), [
      'mon#0',
      'mon#1',
      'mon#2',
      'wed#0',
      'wed#1',
      'wed#2',
    ]);
  });

  test('busy wins over free, whichever order they are written in', () => {
    const rules = [
      { kind: 'free', person: 'sally', days: ['wed'] },
      { kind: 'busy', person: 'sally', slotOfDay: [1] },
    ];

    const forward = parseSpec({ ...week, availability: rules });
    const reversed = parseSpec({ ...week, availability: [...rules].reverse() });

    assert.deepEqual(allowedFor(forward, 'sally'), ['wed#0', 'wed#2']);
    assert.deepEqual(allowedFor(reversed, 'sally'), ['wed#0', 'wed#2']);
  });

  test('rules narrow an explicit slot list rather than replacing it', () => {
    const spec = parseSpec({
      ...week,
      people: [{ id: 'sally', availableSlotIds: ['mon#0', 'tue#0', 'wed#0'] }],
      availability: [{ kind: 'busy', person: 'sally', days: ['tue'] }],
    });

    assert.deepEqual(allowedFor(spec, 'sally'), ['mon#0', 'wed#0']);
  });

  test('a joint meeting is limited by every attendee', () => {
    const spec = parseSpec({
      ...week,
      people: undefined,
      needs: { sally: 1, paul: 1 },
      meetings: [{ id: 'joint', attendees: ['sally', 'paul'] }],
      availability: [
        { kind: 'free', person: 'sally', days: ['mon', 'tue'] },
        { kind: 'free', person: 'paul', days: ['tue', 'wed'] },
      ],
    });

    assert.deepEqual(allowedFor(spec, 'joint'), ['tue#0', 'tue#1', 'tue#2']);
  });

  test('a meeting nobody in it is constrained by is left untouched', () => {
    const spec = parseSpec({
      ...week,
      people: undefined,
      needs: { sally: 1, paul: 1 },
      meetings: [
        { id: 'sally-solo', attendees: ['sally'] },
        { id: 'paul-solo', attendees: ['paul'] },
      ],
      availability: [{ kind: 'busy', person: 'sally', days: ['tue'] }],
    });

    assert.equal(allowedFor(spec, 'paul-solo'), undefined);
    assert.equal(allowedFor(spec, 'sally-solo')?.length, 6);
  });
});

describe('availability rules fail loudly rather than matching nothing', () => {
  const week = {
    days: ['mon', 'tue'],
    slotsPerDay: 2,
    people: [{ id: 'sally' }],
  };

  const rejects = (availability: unknown) => {
    assert.throws(() => parseSpec({ ...week, availability }), InputError);
  };

  test('rejects a non-array availability', () => {
    rejects('busy on tuesday');
  });

  test('rejects a rule that is not an object, or has a bad kind', () => {
    rejects([null]);
    rejects([{ kind: 'maybe', person: 'sally', days: ['mon'] }]);
    rejects([{ kind: 'busy', days: ['mon'] }]);
  });

  test('rejects a rule that selects nothing at all', () => {
    rejects([{ kind: 'busy', person: 'sally' }]);
  });

  test('rejects malformed selectors', () => {
    rejects([{ kind: 'busy', person: 'sally', days: [7] }]);
    rejects([{ kind: 'busy', person: 'sally', slotIds: [7] }]);
    rejects([{ kind: 'busy', person: 'sally', slotOfDay: [-1] }]);
    rejects([{ kind: 'busy', person: 'sally', slotOfDay: [1.5] }]);
  });

  test('rejects an unknown person, so a typo cannot be ignored', () => {
    rejects([{ kind: 'busy', person: 'sallie', days: ['mon'] }]);
  });

  test('rejects a day the grid does not define', () => {
    rejects([{ kind: 'busy', person: 'sally', days: ['thu'] }]);
  });

  test('rejects a slot id the grid does not define', () => {
    rejects([{ kind: 'busy', person: 'sally', slotIds: ['mon#9'] }]);
  });

  test('rejects a slotOfDay past the longest day', () => {
    rejects([{ kind: 'busy', person: 'sally', slotOfDay: [2] }]);
  });

  test('rejects rules that leave a person with nothing', () => {
    rejects([
      { kind: 'free', person: 'sally', days: ['mon'] },
      { kind: 'busy', person: 'sally', days: ['mon'] },
    ]);
  });

  test('names the meeting when two attendees have no slot in common', () => {
    assert.throws(
      () =>
        parseSpec({
          days: ['mon', 'tue'],
          slotsPerDay: 2,
          needs: { sally: 1, paul: 1 },
          meetings: [{ id: 'joint', attendees: ['sally', 'paul'] }],
          availability: [
            { kind: 'free', person: 'sally', days: ['mon'] },
            { kind: 'free', person: 'paul', days: ['tue'] },
          ],
        }),
      /joint/,
    );
  });
});

describe('availability rules stay inside the exact solver', () => {
  const week = {
    days: ['mon', 'tue', 'wed'],
    slotsPerDay: 3,
    people: [{ id: 'sally' }, { id: 'bob' }, { id: 'floyd' }],
  };

  test('a roster keeps its proof once rules narrow it', () => {
    // Rules compile to allowed-slot lists, which is exactly what matching
    // already takes — so nothing about them should cost the exact route.
    const result = run(
      parseSpec({
        ...week,
        availability: [
          { kind: 'busy', person: 'sally', days: ['tue'] },
          { kind: 'busy', person: 'floyd', slotOfDay: [1] },
        ],
      }),
    );

    assert.equal(result.outcome.method, 'exact');
    assert.equal(result.outcome.certainty, 'proof');
  });

  test('an impossible one is proven impossible, not merely unfound', () => {
    const result = run(
      parseSpec({
        days: ['mon'],
        slotsPerDay: 3,
        people: [{ id: 'a' }, { id: 'b' }],
        availability: [
          { kind: 'free', person: 'a', slotOfDay: [0] },
          { kind: 'free', person: 'b', slotOfDay: [0] },
        ],
      }),
    );

    assert.equal(result.outcome.scheduled, false);
    assert.equal(result.outcome.certainty, 'proof');
    assert.deepEqual(result.outcome.bottleneck?.meetings, ['a', 'b']);
    assert.deepEqual(result.outcome.bottleneck?.slots, ['mon#0']);
  });
});

describe('availability rules replace hand-written complements', () => {
  test('the whole of the task note, said in three rules', () => {
    const result = run(
      parseSpec({
        days: ['mon', 'tue', 'wed', 'thu', 'fri'],
        slotsPerDay: 3,
        people: [{ id: 'sally' }, { id: 'bob' }, { id: 'floyd' }],
        availability: [
          { kind: 'busy', person: 'sally', days: ['tue'] },
          { kind: 'busy', person: 'bob', days: ['wed'] },
          { kind: 'busy', person: 'floyd', slotOfDay: [1] },
        ],
      }),
    );

    assert.equal(result.outcome.scheduled, true);

    const placed = new Map(
      (result.plan?.scheduled ?? []).map((entry) => [
        entry.meeting.id,
        entry.slot,
      ]),
    );

    const floyd = placed.get('floyd');

    assert.equal(placed.size, 3);
    assert.notEqual(placed.get('sally')?.day, 'tue');
    assert.notEqual(placed.get('bob')?.day, 'wed');
    assert.notEqual(floyd && floyd.index % 3, 1);
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

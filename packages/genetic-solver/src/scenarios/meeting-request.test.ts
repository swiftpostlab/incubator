import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { InputError, parseSpec, run } from './meeting-request.ts';
import type { MeetingProblemSpec } from './meeting-scheduling.ts';

const defaultOptions = {
  seed: 1,
  localSearchSteps: 8,
  maxGenerations: 200,
} as const;

const feasibleSpec = {
  days: ['mon', 'tue'],
  slotsPerDay: 3,
  people: [
    { id: 'ana', availableSlotIds: ['mon#0', 'mon#1'] },
    { id: 'bo', availableSlotIds: ['mon#1', 'tue#0'] },
    { id: 'cy', availableSlotIds: ['tue#0', 'tue#2'] },
  ],
};

describe('parseSpec shape validation', () => {
  test('rejects anything that is not an object', () => {
    assert.throws(() => parseSpec([]), InputError);
    assert.throws(() => parseSpec('spec'), InputError);
    assert.throws(() => parseSpec(null), InputError);
  });

  test('rejects a missing or malformed people array', () => {
    assert.throws(
      () => parseSpec({ days: ['mon'], slotsPerDay: 2 }),
      InputError,
    );
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
    const spec = parseSpec(feasibleSpec);

    assert.equal(spec.slots.length, 6);
    assert.deepEqual(
      spec.slots.map((slot) => slot.id),
      ['mon#0', 'mon#1', 'mon#2', 'tue#0', 'tue#1', 'tue#2'],
    );
  });

  test('passes an explicit slot list through untouched', () => {
    const slots = [{ id: 'only', day: 'mon', index: 0 }];
    const spec = parseSpec({
      slots,
      people: [{ id: 'ana', availableSlotIds: ['only'] }],
    });

    assert.deepEqual(spec.slots, slots);
  });

  test('leaves semantic errors to the scenario, so the rules live in one place', () => {
    // Shape is fine here; the slot id is not one the grid defines. parseSpec
    // must not catch that itself, or the two validators can drift apart.
    const spec = parseSpec({
      days: ['mon'],
      slotsPerDay: 2,
      people: [{ id: 'ana', availableSlotIds: ['nope#9'] }],
    });

    assert.throws(() => run(spec, defaultOptions), RangeError);
  });
});

describe('run solver selection', () => {
  test('uses the exact solver alone when there are no preferences', () => {
    const outcome = run(parseSpec(feasibleSpec), defaultOptions);

    assert.equal(outcome.scheduled, true);
    assert.equal(outcome.method, 'exact');
    assert.equal(outcome.softViolation, undefined);
    assert.deepEqual(outcome.unplaced, []);
    assert.equal(outcome.assignment?.length, 3);
  });

  test('treats zero-weight preferences as no preferences', () => {
    const outcome = run(
      parseSpec({
        ...feasibleSpec,
        preferences: { compactDaysWeight: 0, earlinessWeight: 0 },
      }),
      defaultOptions,
    );

    assert.equal(outcome.method, 'exact');
  });

  test('adds the genetic pass once a preference carries weight', () => {
    const outcome = run(
      parseSpec({ ...feasibleSpec, preferences: { compactDaysWeight: 1 } }),
      defaultOptions,
    );

    assert.equal(outcome.scheduled, true);
    assert.equal(outcome.method, 'exact+genetic');
    assert.ok(outcome.softViolation !== undefined);
  });

  test('never returns an infeasible schedule from the genetic pass', () => {
    // The seed is already feasible, so refinement must not downgrade it. This
    // guards the one failure that would be worst: a valid schedule replaced by
    // an invalid one that still reports success.
    const outcome = run(
      parseSpec({
        ...feasibleSpec,
        preferences: { compactDaysWeight: 3, earlinessWeight: 2 },
      }),
      defaultOptions,
    );

    assert.equal(outcome.scheduled, true);

    const slots = outcome.assignment ?? [];
    assert.equal(new Set(slots).size, slots.length, 'a slot was double booked');
  });

  test('is deterministic for a given seed', () => {
    const spec = parseSpec({
      ...feasibleSpec,
      preferences: { compactDaysWeight: 1 },
    });

    assert.deepEqual(
      run(spec, defaultOptions).assignment,
      run(spec, defaultOptions).assignment,
    );
  });
});

describe('run on an impossible request', () => {
  const impossible: MeetingProblemSpec = parseSpec({
    days: ['mon'],
    slotsPerDay: 3,
    people: [
      { id: 'ana', availableSlotIds: ['mon#0'] },
      { id: 'bo', availableSlotIds: ['mon#0'] },
      { id: 'cy', availableSlotIds: ['mon#0'] },
    ],
  });

  test('reports failure without falling back to the search', () => {
    const outcome = run(impossible, defaultOptions);

    assert.equal(outcome.scheduled, false);
    assert.equal(outcome.method, 'exact');
    assert.equal(outcome.assignment, undefined);
  });

  test('names the people who could not be placed', () => {
    const outcome = run(impossible, defaultOptions);

    assert.equal(outcome.unplaced.length, 2);
    outcome.unplaced.forEach((id) => {
      assert.ok(['ana', 'bo', 'cy'].includes(id));
    });
  });

  test('reports a bottleneck with more people than slots', () => {
    const { bottleneck } = run(impossible, defaultOptions);

    assert.ok(bottleneck);
    assert.ok(bottleneck.people.length > bottleneck.slots.length);
    assert.deepEqual([...bottleneck.slots], ['mon#0']);
  });

  test('still reports failure when preferences are set', () => {
    const outcome = run(
      { ...impossible, preferences: { compactDaysWeight: 1 } },
      defaultOptions,
    );

    assert.equal(outcome.scheduled, false);
    assert.equal(outcome.method, 'exact');
  });
});

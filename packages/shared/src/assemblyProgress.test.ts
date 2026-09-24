import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assemblyEquivalentWeight,
  assemblyListWeight,
  formatProjectProgress,
  projectProgressPercent,
} from './assemblyProgress';

describe('assemblyListWeight', () => {
  it('multiplies pieces by weight per piece', () => {
    const result = assemblyListWeight([
      { quantity: 4, weightPerPiece: 12.5 },
      { quantity: 2, weightPerPiece: 100 },
    ]);
    assert.deepEqual(result, { weightKg: 250, withoutWeight: 0 });
  });

  it('leaves lines without a weight out and counts them', () => {
    const result = assemblyListWeight([
      { quantity: 4, weightPerPiece: 12.5 },
      { quantity: 7, weightPerPiece: null },
    ]);
    assert.deepEqual(result, { weightKg: 50, withoutWeight: 1 });
  });

  it('reports no weight at all when no line carries one', () => {
    const result = assemblyListWeight([{ quantity: 3, weightPerPiece: null }]);
    assert.deepEqual(result, { weightKg: null, withoutWeight: 1 });
  });

  it('reads an empty list as no weight', () => {
    assert.deepEqual(assemblyListWeight([]), { weightKg: null, withoutWeight: 0 });
  });
});

describe('projectProgressPercent', () => {
  it('weighs each activity by its share', () => {
    const percent = projectProgressPercent({
      doneEquivalentKgByActivity: { weld: 100, paint: 0 },
      totalEquivalentKg: 100,
      activityShares: { weld: 0.8, paint: 0.2 },
    });
    assert.equal(percent, 80);
  });

  it('is null without a list or without tracked activities', () => {
    assert.equal(
      projectProgressPercent({ doneEquivalentKgByActivity: {}, totalEquivalentKg: 0, activityShares: { a: 1 } }),
      null,
    );
    assert.equal(
      projectProgressPercent({ doneEquivalentKgByActivity: {}, totalEquivalentKg: 100, activityShares: {} }),
      null,
    );
  });

  it('weighs a light piece by its fixed part as well as its kilograms', () => {
    // 10 columns of 2 t done, 200 parts of 10 kg open, one tracked activity.
    const column = assemblyEquivalentWeight(2000, 75);
    const part = assemblyEquivalentWeight(10, 75);
    const percent = projectProgressPercent({
      doneEquivalentKgByActivity: { a: 10 * column },
      totalEquivalentKg: 10 * column + 200 * part,
      activityShares: { a: 1 },
    });
    assert.ok(percent !== null && percent > 50 && percent < 60);
  });

  it('does not let one over-reported activity carry the others', () => {
    const percent = projectProgressPercent({
      doneEquivalentKgByActivity: { a: 500, b: 0 },
      totalEquivalentKg: 100,
      activityShares: { a: 0.5, b: 0.5 },
    });
    assert.equal(percent, 50);
  });
});

describe('formatProjectProgress', () => {
  it('rounds down', () => {
    assert.equal(formatProjectProgress(99.9), '99%');
  });
});

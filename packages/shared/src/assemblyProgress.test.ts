import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assemblyListWeight } from './assemblyProgress';

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

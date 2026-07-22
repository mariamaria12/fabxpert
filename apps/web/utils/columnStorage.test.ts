import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeWithDefaults, readColumnPrefs, type ColumnPreference } from './columnStorage';

const defaultColumns: ColumnPreference[] = [
  { id: 'name', visible: true, width: 240, order: 0 },
  { id: 'status', visible: true, width: 140, order: 1 },
  { id: 'owner', visible: true, width: 180, order: 2 },
];

test('mergeWithDefaults adds new code columns and drops removed stored ones', () => {
  const merged = mergeWithDefaults(defaultColumns, {
    v: 1,
    columns: {
      name: { visible: false, width: 300, order: 1 },
      status: { visible: true, width: 150, order: 0 },
      legacy: { visible: true, width: 99, order: 2 },
    },
  });

  assert.deepEqual(merged, [
    { id: 'status', visible: true, width: 150, order: 0 },
    { id: 'name', visible: false, width: 300, order: 1 },
    { id: 'owner', visible: true, width: 180, order: 2 },
  ]);
});

test('mergeWithDefaults falls back to defaults on version mismatch', () => {
  const merged = mergeWithDefaults(defaultColumns, {
    v: 999,
    columns: {
      name: { visible: false, width: 300, order: 0 },
    },
  });

  assert.deepEqual(merged, defaultColumns);
});

test('readColumnPrefs falls back to defaults on corrupted storage', () => {
  const storage = {
    getItem() {
      return '{not-valid-json';
    },
    setItem() {
      throw new Error('not used');
    },
  };

  const merged = readColumnPrefs(storage, 'columns:user:view', defaultColumns);
  assert.deepEqual(merged, defaultColumns);
});

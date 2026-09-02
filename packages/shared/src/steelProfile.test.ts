import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProfileKey, toProfileKey } from './steelProfile';

test('normalizeProfileKey folds the ways one profile gets typed', () => {
  const expected = 'CFCHS48.3X3.6';
  assert.equal(normalizeProfileKey('CFCHS48.3*3.6'), expected);
  assert.equal(normalizeProfileKey('CFCHS 48.3x3.6'), expected);
  assert.equal(normalizeProfileKey('CFCHS48,3X3,6'), expected);
  assert.equal(normalizeProfileKey('cfchs48.3×3.6'), expected);
});

test('normalizeProfileKey leaves rolled sections alone', () => {
  assert.equal(normalizeProfileKey('HEA280'), 'HEA280');
  assert.equal(normalizeProfileKey('IPE600'), 'IPE600');
  assert.equal(normalizeProfileKey('PL8x90'), 'PL8X90');
  assert.equal(normalizeProfileKey('PL20x300'), 'PL20X300');
});

test('toProfileKey treats blank input as no profile', () => {
  assert.equal(toProfileKey(null), null);
  assert.equal(toProfileKey(''), null);
  assert.equal(toProfileKey('  '), null);
  assert.equal(toProfileKey('HEA280'), 'HEA280');
});

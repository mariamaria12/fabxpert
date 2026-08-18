import test from 'node:test';
import assert from 'node:assert/strict';
import { formatFinisajLabel, parseFinisaj, splitFinisaj } from './finisaj';

test('splitFinisaj gives one segment per finish in a sum', () => {
  assert.deepEqual(splitFinisaj('Grund AL + zincare'), ['Grund AL', 'zincare']);
  assert.deepEqual(splitFinisaj('GRUND AL + ZINCARE'), ['GRUND AL', 'ZINCARE']);
  assert.deepEqual(splitFinisaj('  Grund AL  +  zincare  '), ['Grund AL', 'zincare']);
  assert.deepEqual(splitFinisaj('a + b + c'), ['a', 'b', 'c']);
});

test('splitFinisaj keeps paint formulas whole', () => {
  // The "+" belongs to the formula, so these must stay exactly one badge.
  assert.deepEqual(splitFinisaj('EP+PU'), ['EP+PU']);
  assert.deepEqual(splitFinisaj('(EP+PU) RAL 7033'), ['(EP+PU) RAL 7033']);
  assert.deepEqual(splitFinisaj('Vopsire (EP+PU)'), ['Vopsire (EP+PU)']);
});

test('splitFinisaj splits around a formula without breaking it', () => {
  assert.deepEqual(splitFinisaj('Vopsire (EP+PU) + zincare'), ['Vopsire (EP+PU)', 'zincare']);
  assert.deepEqual(splitFinisaj('zincare + (EP+PU)'), ['zincare', '(EP+PU)']);
  // A rejected "+" stays inside its segment instead of splitting into three.
  assert.deepEqual(splitFinisaj('EP+PU + zincare'), ['EP+PU', 'zincare']);
});

test('splitFinisaj splits a spaceless "+" only between finishes it recognises', () => {
  assert.deepEqual(splitFinisaj('zincare+RAL 9002'), ['zincare', 'RAL 9002']);
  assert.deepEqual(splitFinisaj('RAL9002+RAL7016'), ['RAL9002', 'RAL7016']);
  assert.deepEqual(splitFinisaj('Grund AL+zincare'), ['Grund AL+zincare']);
});

test('splitFinisaj never drops text', () => {
  assert.deepEqual(splitFinisaj('Zincare +'), ['Zincare +']);
  assert.deepEqual(splitFinisaj('+ zincare'), ['+ zincare']);
  assert.deepEqual(splitFinisaj('+'), ['+']);
  assert.deepEqual(splitFinisaj('zincare'), ['zincare']);
});

test('splitFinisaj renders nothing for an empty finish', () => {
  assert.deepEqual(splitFinisaj(null), []);
  assert.deepEqual(splitFinisaj(undefined), []);
  assert.deepEqual(splitFinisaj('   '), []);
});

test('formatFinisajLabel keeps abbreviations but not words typed in capitals', () => {
  assert.equal(formatFinisajLabel('grund AL'), 'Grund AL');
  assert.equal(formatFinisajLabel('GRUND AL'), 'Grund AL');
  assert.equal(formatFinisajLabel('ZINCARE'), 'Zincare');
  assert.equal(formatFinisajLabel('ZINCARE LA CALD'), 'Zincare la cald');
  assert.equal(formatFinisajLabel('GRUND SI VOPSEA'), 'Grund si vopsea');
  assert.equal(formatFinisajLabel('vopsire electrostatica'), 'Vopsire electrostatica');
});

test('formatFinisajLabel leaves codes and formulas alone', () => {
  assert.equal(formatFinisajLabel('(EP+PU)'), '(EP+PU)');
  assert.equal(formatFinisajLabel('2K'), '2K');
});

test('each segment parses on its own', () => {
  const [grund, zincare] = splitFinisaj('Grund AL + zincare').map(parseFinisaj);

  assert.deepEqual(grund, { kind: 'plain', label: 'Grund AL', hex: null });
  assert.deepEqual(zincare, { kind: 'plain', label: 'Zincare', hex: '#BFC5C8' });
});

test('a RAL code still carries its action text', () => {
  assert.deepEqual(parseFinisaj('(EP+PU) RAL 7033'), {
    kind: 'ral',
    code: '7033',
    label: 'RAL 7033',
    hex: '#818979',
    action: '(EP+PU)',
  });
});

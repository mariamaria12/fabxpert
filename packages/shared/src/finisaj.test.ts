import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatFinisajLabel,
  joinFinisaj,
  parseFinisaj,
  ralCodesInText,
  splitFinisaj,
  splitTextByRal,
  takeCompletedFinisaj,
} from './finisaj';

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

test('splitFinisaj gives one segment per RAL code', () => {
  assert.deepEqual(splitFinisaj('RAL 1015  RAL 1003'), ['RAL 1015', 'RAL 1003']);
  assert.deepEqual(splitFinisaj('RAL1015, RAL1003'), ['RAL1015', 'RAL1003']);
  assert.deepEqual(splitFinisaj('RAL 1015 / RAL 1003 / RAL 9005'), [
    'RAL 1015',
    'RAL 1003',
    'RAL 9005',
  ]);
  assert.deepEqual(splitFinisaj('RAL 1015 si RAL 1003'), ['RAL 1015', 'RAL 1003']);
  assert.deepEqual(splitFinisaj('RAL 1015 + RAL 1003'), ['RAL 1015', 'RAL 1003']);
});

test('text around a RAL code stays with that code', () => {
  assert.deepEqual(splitFinisaj('Vopsit RAL 1015, RAL 1003 mat'), [
    'Vopsit RAL 1015',
    'RAL 1003 mat',
  ]);
  assert.deepEqual(splitFinisaj('zincare + RAL 1015 RAL 1003'), [
    'zincare',
    'RAL 1015',
    'RAL 1003',
  ]);
  // An unknown code still gets its own (outline) badge.
  assert.deepEqual(splitFinisaj('RAL 1015 RAL 1234'), ['RAL 1015', 'RAL 1234']);
});

test('joinFinisaj writes a value splitFinisaj reads back', () => {
  const segments = ['RAL 1015', 'RAL 1003', 'EP+PU', 'zincare'];

  assert.equal(joinFinisaj(segments), 'RAL 1015 + RAL 1003 + EP+PU + zincare');
  assert.deepEqual(splitFinisaj(joinFinisaj(segments)), segments);
  assert.equal(joinFinisaj(['RAL 1015', '  ']), 'RAL 1015');
});

test('takeCompletedFinisaj takes a RAL code as soon as it is complete', () => {
  assert.deepEqual(takeCompletedFinisaj('RAL 101'), { completed: [], rest: 'RAL 101' });
  assert.deepEqual(takeCompletedFinisaj('RAL 1015'), { completed: ['RAL 1015'], rest: '' });
  assert.deepEqual(takeCompletedFinisaj('ral1015 RAL 10'), {
    completed: ['ral1015'],
    rest: 'RAL 10',
  });
  assert.deepEqual(takeCompletedFinisaj('RAL 1015, RAL 1003 mat'), {
    completed: ['RAL 1015', 'RAL 1003'],
    rest: 'mat',
  });
});

test('takeCompletedFinisaj leaves text it cannot map', () => {
  assert.deepEqual(takeCompletedFinisaj('zincare'), { completed: [], rest: 'zincare' });
  assert.deepEqual(takeCompletedFinisaj('RAL 1234'), { completed: [], rest: 'RAL 1234' });
});

test('splitTextByRal picks the RAL codes out of running text', () => {
  assert.deepEqual(splitTextByRal('Stâlpii ral7016, grinzile RAL 9005 mat.'), [
    { kind: 'text', text: 'Stâlpii ' },
    { kind: 'ral', text: 'ral7016', label: 'RAL 7016' },
    { kind: 'text', text: ', grinzile ' },
    { kind: 'ral', text: 'RAL 9005', label: 'RAL 9005' },
    { kind: 'text', text: ' mat.' },
  ]);
});

test('splitTextByRal keeps line breaks and text without a code as they are', () => {
  assert.deepEqual(splitTextByRal('Livrare luni.\nFără vopsea.'), [
    { kind: 'text', text: 'Livrare luni.\nFără vopsea.' },
  ]);
  assert.deepEqual(splitTextByRal(''), []);
  assert.deepEqual(splitTextByRal(null), []);
});

test('splitTextByRal leaves unknown codes and look-alikes as text', () => {
  // Not in RAL Classic, part of a longer word, part of a longer number.
  for (const text of ['RAL 1234', 'CORAL 7016', 'RAL 70161']) {
    assert.deepEqual(splitTextByRal(text), [{ kind: 'text', text }]);
  }
});

test('ralCodesInText lists each code once, in order', () => {
  assert.deepEqual(ralCodesInText('RAL 9005 sus, RAL7016 jos, apoi iar ral 9005'), [
    'RAL 9005',
    'RAL 7016',
  ]);
});

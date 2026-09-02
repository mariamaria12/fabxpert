import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAssemblyImport,
  parseAssemblyNumber,
  parseAssemblyQuantity,
} from './assemblyImport';

test('parseAssemblyNumber reads "." as a thousands separator', () => {
  // Romanian Excel writes 2800 mm as "2.800" — a decimal read would give 2.8.
  assert.equal(parseAssemblyNumber('2.800'), 2800);
  assert.equal(parseAssemblyNumber('2.982'), 2982);
  assert.equal(parseAssemblyNumber('1.080'), 1080);
  assert.equal(parseAssemblyNumber('7.610'), 7610);
  assert.equal(parseAssemblyNumber('6.035'), 6035);
});

test('parseAssemblyNumber keeps ungrouped numbers as they are', () => {
  assert.equal(parseAssemblyNumber('232'), 232);
  assert.equal(parseAssemblyNumber('980'), 980);
  assert.equal(parseAssemblyNumber('100'), 100);
});

test('parseAssemblyNumber keeps fractions instead of rounding them', () => {
  // Real lists carry these; the sheet only rounds them for display.
  assert.equal(parseAssemblyNumber('2981.6'), 2981.6);
  assert.equal(parseAssemblyNumber('7784,5'), 7784.5);
});

test('parseAssemblyNumber survives the spaces Excel pastes', () => {
  // Excel groups with a non-breaking space as readily as with a dot.
  assert.equal(parseAssemblyNumber('2800'), 2800);
  assert.equal(parseAssemblyNumber(' 232 '), 232);
});

test('parseAssemblyNumber reports what it cannot read', () => {
  assert.equal(parseAssemblyNumber(''), null);
  assert.equal(parseAssemblyNumber('-'), null);
  assert.equal(parseAssemblyNumber('vezi desen'), null);
});

test('parseAssemblyQuantity accepts whole pieces only', () => {
  assert.equal(parseAssemblyQuantity('1'), 1);
  assert.equal(parseAssemblyQuantity('12'), 12);
  assert.equal(parseAssemblyQuantity(''), null);
  assert.equal(parseAssemblyQuantity('0'), null);
  assert.equal(parseAssemblyQuantity('x'), null);
});

const PASTED = [
  '\t#NAME?\t\t\t\t',
  'Nr. Crt.\tANSAMBLU\tNr. bucăți\tProfil\tLungime\tGreutate (Kg./buc.)',
  '1\tGBAL/1\t1\tCFCHS48.3*3.6\t2.800\t58,98',
  '2\tGBAL/2\t1\tCFCHS48.3*3.6\t232\t11,43',
  '3\tGBAL/3\t2\tCFCHS48.3*3.6\t2.982\t36,65',
  '25\tGBAL/25\t7\tPL8x90\t100\t1,13',
  '35\tGGRP/1\t1\tHEA280\t7.610\t792,96',
].join('\n');

test('parseAssemblyImport maps columns from the Romanian header row', () => {
  const result = parseAssemblyImport(PASTED);

  assert.equal(result.hasHeaderRow, true);
  assert.deepEqual(result.columns, {
    name: 1,
    quantity: 2,
    profile: 3,
    length: 4,
    weightPerPiece: 5,
  });
  assert.equal(result.rows.length, 5);
  assert.deepEqual(result.issues, []);
});

test('parseAssemblyImport skips the title block above the header', () => {
  const [first] = parseAssemblyImport(PASTED).rows;

  assert.equal(first.name, 'GBAL/1');
  assert.equal(first.quantity, 1);
  assert.equal(first.profile, 'CFCHS48.3*3.6');
  assert.equal(first.length, 2800);
  assert.equal(first.weightPerPiece, 58.98);
});

test('parseAssemblyImport reads the per-piece weight, not the totals beside it', () => {
  // "Masa teoretică" and "Masa comercială" sit further along the same row.
  const result = parseAssemblyImport(
    [
      'ANSAMBLU\tNr. bucăți\tProfil\tLungime\tGreutate (Kg./buc.)\tMasa teoretică\tMasa comercială',
      'GBAL/3\t2\tCFCHS48.3*3.6\t2981,6\t36,65\t73,3\t75,499',
    ].join('\n'),
  );

  assert.equal(result.rows[0].weightPerPiece, 36.65);
  assert.equal(result.rows[0].length, 2981.6);
});

test('parseAssemblyImport ignores columns it was not asked for', () => {
  const rows = parseAssemblyImport(PASTED).rows;
  const plate = rows.find((row) => row.name === 'GBAL/25');

  assert.equal(plate?.quantity, 7);
  assert.equal(plate?.length, 100);
});

test('parseAssemblyImport flags a bad cell but still imports the row', () => {
  const result = parseAssemblyImport(
    [
      'ANSAMBLU\tNr. bucăți\tProfil\tLungime',
      'GBAL/1\t\tHEA280\tvezi desen',
    ].join('\n'),
  );

  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].quantity, 1);
  assert.equal(result.rows[0].length, null);
  assert.deepEqual(
    result.issues.map((issue) => issue.code),
    ['INVALID_QUANTITY', 'INVALID_LENGTH'],
  );
});

test('parseAssemblyImport drops only rows with no mark', () => {
  const result = parseAssemblyImport(
    ['ANSAMBLU\tNr. bucăți\tProfil\tLungime', '\t3\tHEA280\t100', 'GBAL/2\t1\tIPE600\t500'].join('\n'),
  );

  assert.deepEqual(result.rows.map((row) => row.name), ['GBAL/2']);
  assert.deepEqual(result.issues.map((issue) => issue.code), ['MISSING_NAME']);
});

test('parseAssemblyImport keeps the last of a repeated mark and says so', () => {
  const result = parseAssemblyImport(
    ['ANSAMBLU\tNr. bucăți\tProfil\tLungime', 'GBAL/1\t1\tHEA280\t100', 'GBAL/1\t4\tIPE600\t500'].join('\n'),
  );

  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].quantity, 4);
  assert.deepEqual(result.issues.map((issue) => issue.code), ['DUPLICATE_NAME']);
});

test('parseAssemblyImport falls back to column order without a header', () => {
  const result = parseAssemblyImport(['GBAL/1\t2\tHEA280\t2.800\t58,98'].join('\n'));

  assert.equal(result.hasHeaderRow, false);
  assert.deepEqual(result.issues.map((issue) => issue.code), ['NO_HEADER_ROW']);
  assert.deepEqual(result.rows[0], {
    row: 1,
    name: 'GBAL/1',
    quantity: 2,
    profile: 'HEA280',
    length: 2800,
    weightPerPiece: 58.98,
  });
});

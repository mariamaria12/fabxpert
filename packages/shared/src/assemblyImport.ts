import type { AssemblyImportIssue, AssemblyImportRowDto } from './dto/assembly.dto';
import { parseTsvRows } from './tsv';

export type ParsedAssemblyRow = AssemblyImportRowDto;

/**
 * One cell of an assembly list. A pasted list is text throughout; an uploaded
 * workbook hands over the numbers themselves, which are kept as such so the
 * separators never have to be guessed at.
 */
export type AssemblyCell = string | number;

/** Which pasted column each field was read from; -1 means "not found". */
export type AssemblyImportColumnMap = {
  name: number;
  quantity: number;
  profile: number;
  length: number;
  weightPerPiece: number;
};

export type ParseAssemblyImportResult = {
  rows: ParsedAssemblyRow[];
  issues: AssemblyImportIssue[];
  columns: AssemblyImportColumnMap;
  /** True when a header row was recognized and columns were mapped by name. */
  hasHeaderRow: boolean;
};

const HEADER_ALIASES: Record<keyof AssemblyImportColumnMap, string[]> = {
  name: ['ansamblu', 'ansamble', 'marca', 'reper', 'denumire'],
  quantity: ['nrbucati', 'nrbuc', 'bucati', 'buc', 'cantitate', 'nrbucbuc'],
  profile: ['profil', 'profile', 'sectiune'],
  length: ['lungime', 'lungimemm', 'lungimel'],
  // Matched exactly, so "masa teoretică" and "masa comercială" further along
  // the row are left alone — those are totals, not the per-piece weight.
  weightPerPiece: ['greutatekgbuc', 'greutatebuc', 'greutate', 'masaindividualakg'],
};

/** Order used when the paste has no header row. */
const POSITIONAL_COLUMNS: AssemblyImportColumnMap = {
  name: 0,
  quantity: 1,
  profile: 2,
  length: 3,
  weightPerPiece: 4,
};

/** Lowercase, strip diacritics and everything that is not a letter or digit. */
function headerKey(cell: string): string {
  return cell
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function cellText(cells: AssemblyCell[], index: number): string {
  if (index < 0) {
    return '';
  }
  return String(cells[index] ?? '').replace(/\u00A0/g, ' ').trim();
}

/** Same cell, with a workbook number left as a number. */
function cellValue(cells: AssemblyCell[], index: number): AssemblyCell {
  const cell = index < 0 ? '' : cells[index];
  return typeof cell === 'number' ? cell : cellText(cells, index);
}

/**
 * Turn whatever separators a cell carries into a plain decimal point.
 *
 * A cell with both — "1.234,56" out of a Romanian sheet, "1,234.56" out of an
 * English one — groups thousands with the first and cuts decimals with the
 * last; reading both as decimal points loses a factor of a thousand. With only
 * dots, "2.800" is 2800 rather than 2.8: that is how a Romanian sheet displays
 * a length, and a dot before exactly three digits never means otherwise there.
 * A separator that repeats can only be grouping, whichever one it is.
 */
function normalizeDecimalSeparator(text: string): string {
  const firstComma = text.indexOf(',');
  const lastComma = text.lastIndexOf(',');
  const firstDot = text.indexOf('.');
  const lastDot = text.lastIndexOf('.');

  if (lastComma >= 0 && lastDot >= 0) {
    return lastComma > lastDot
      ? text.replace(/\./g, '').replace(',', '.')
      : text.replace(/,/g, '');
  }

  if (firstComma !== lastComma) {
    return text.replace(/,/g, '');
  }

  if (firstDot !== lastDot || /^\d{1,3}(\.\d{3})+$/.test(text)) {
    return text.replace(/\./g, '');
  }

  return text.replace(',', '.');
}

/**
 * Lengths and weights carry fractions (2981.6 mm, 58.98 kg), so nothing is
 * rounded here.
 *
 * The separator guess is only for the pasted path — the clipboard carries what
 * the sheet displayed, separators and all. A workbook cell arrives as the
 * number itself and is taken as it is, so a 2.982 kg piece stays 2.982 kg where
 * the same text pasted would read as 2982.
 */
export function parseAssemblyNumber(value: AssemblyCell): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  const text = value.replace(/\s/g, '');
  if (text === '') {
    return null;
  }

  const parsed = Number.parseFloat(normalizeDecimalSeparator(text));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

/** Piece counts are small whole numbers; anything else is unreadable. */
export function parseAssemblyQuantity(value: AssemblyCell): number | null {
  const parsed = parseAssemblyNumber(value);
  if (parsed === null || parsed < 1) {
    return null;
  }

  return Math.round(parsed);
}

function findHeaderRow(
  rows: AssemblyCell[][],
): { index: number; columns: AssemblyImportColumnMap } | null {
  // Only the first few rows can be a header — the sheet carries a title block
  // above it, and a data row must never be mistaken for one.
  const limit = Math.min(rows.length, 10);

  for (let index = 0; index < limit; index += 1) {
    const keys = rows[index].map((cell) => headerKey(String(cell ?? '')));
    const columns: AssemblyImportColumnMap = {
      name: -1,
      quantity: -1,
      profile: -1,
      length: -1,
      weightPerPiece: -1,
    };

    for (const field of Object.keys(HEADER_ALIASES) as (keyof AssemblyImportColumnMap)[]) {
      columns[field] = keys.findIndex((key) => key !== '' && HEADER_ALIASES[field].includes(key));
    }

    if (columns.name >= 0 && (columns.quantity >= 0 || columns.profile >= 0)) {
      return { index, columns };
    }
  }

  return null;
}

/**
 * Read an assembly list pasted out of the drawing spreadsheet.
 * The uploaded-workbook path feeds parseAssemblyRows directly.
 */
export function parseAssemblyImport(text: string): ParseAssemblyImportResult {
  return parseAssemblyRows(parseTsvRows(text));
}

/**
 * Interpret a grid of cells as an assembly list, whichever way it arrived.
 * Every row that carries a mark comes back, unreadable cells included — those
 * are reported as issues so the admin can see them, not dropped.
 */
export function parseAssemblyRows(rawRows: AssemblyCell[][]): ParseAssemblyImportResult {
  const header = findHeaderRow(rawRows);
  const columns = header ? header.columns : POSITIONAL_COLUMNS;
  const firstDataRow = header ? header.index + 1 : 0;

  const issues: AssemblyImportIssue[] = [];
  if (!header) {
    issues.push({ row: 0, name: null, code: 'NO_HEADER_ROW', value: null });
  }

  const byName = new Map<string, ParsedAssemblyRow>();

  for (let index = firstDataRow; index < rawRows.length; index += 1) {
    const cells = rawRows[index];
    const rowNumber = index + 1;

    const rawQuantity = cellValue(cells, columns.quantity);
    const name = cellText(cells, columns.name);

    if (name === '') {
      // A row with a mark missing but data in the other columns lost something
      // and is worth reporting. A row with nothing in any of them is the totals
      // line under the table — not a problem, and not worth nagging about.
      const looksLikeData =
        rawQuantity !== '' ||
        cellText(cells, columns.profile) !== '' ||
        cellText(cells, columns.length) !== '';
      if (looksLikeData) {
        issues.push({ row: rowNumber, name: null, code: 'MISSING_NAME', value: null });
      }
      continue;
    }

    const quantity = parseAssemblyQuantity(rawQuantity);
    if (quantity === null) {
      issues.push({
        row: rowNumber,
        name,
        code: 'INVALID_QUANTITY',
        value: String(rawQuantity) || null,
      });
    }

    const rawLength = cellValue(cells, columns.length);
    const length = rawLength === '' ? null : parseAssemblyNumber(rawLength);
    if (rawLength !== '' && length === null) {
      issues.push({ row: rowNumber, name, code: 'INVALID_LENGTH', value: String(rawLength) });
    }

    const rawWeight = cellValue(cells, columns.weightPerPiece);
    const weightPerPiece = rawWeight === '' ? null : parseAssemblyNumber(rawWeight);
    if (rawWeight !== '' && weightPerPiece === null) {
      issues.push({ row: rowNumber, name, code: 'INVALID_WEIGHT', value: String(rawWeight) });
    }

    if (byName.has(name)) {
      issues.push({ row: rowNumber, name, code: 'DUPLICATE_NAME', value: null });
    }

    const profile = cellText(cells, columns.profile);
    byName.set(name, {
      row: rowNumber,
      name,
      quantity: quantity ?? 1,
      profile: profile === '' ? null : profile,
      length,
      weightPerPiece,
    });
  }

  return {
    rows: [...byName.values()],
    issues,
    columns,
    hasHeaderRow: header !== null,
  };
}

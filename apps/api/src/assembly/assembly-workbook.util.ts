import ExcelJS from 'exceljs';
import { parseAssemblyNumber, type AssemblyCell } from '@fabxpert/shared/assemblyImport';

/**
 * The cell's own value, not what Excel draws in it. The displayed text of a
 * length reads "2.982" where the value is 2981.6 — reading the file is only
 * worth doing if we take the number underneath. A number is passed on as a
 * number for the same reason: "2.982" as text is read as 2982, which is right
 * for a length off the clipboard and wrong for a 2.982 kg piece.
 */
function cellToValue(value: ExcelJS.CellValue): AssemblyCell {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    if ('result' in value) {
      return cellToValue((value as ExcelJS.CellFormulaValue).result ?? null);
    }
    if ('richText' in value) {
      return (value as ExcelJS.CellRichTextValue).richText.map((part) => part.text).join('');
    }
    if ('text' in value) {
      return String((value as ExcelJS.CellHyperlinkValue).text ?? '');
    }
  }
  return '';
}

function sheetToRows(sheet: ExcelJS.Worksheet): AssemblyCell[][] {
  const rows: AssemblyCell[][] = [];

  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: AssemblyCell[] = [];
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      cells[columnNumber - 1] = cellToValue(cell.value);
    });
    rows.push([...cells].map((cell) => cell ?? ''));
  });

  return rows;
}

export type WorkbookParts = {
  /** Parts across the list: parts in each assembly times its quantity. */
  pieces: number;
  /** What those parts weigh, in kilograms. */
  weightKg: number;
};

export type WorkbookPreview = {
  /** Every sheet name in the workbook, in order. */
  sheets: string[];
  /** Cells of the chosen sheet, ready for parseAssemblyRows. Empty when none. */
  rows: AssemblyCell[][];
  sheetName: string | null;
  /** The parts breakdown added up; null when the workbook has none to read. */
  parts: WorkbookParts | null;
};

/** The sheet a project workbook keeps its assembly list on. */
const ASSEMBLY_SHEET_NAME = 'ANSAMBLE';

/** The sheet that breaks every assembly down into its parts. */
const PARTS_SHEET_NAME = 'DETALIEREANSAMBLE';

/**
 * Its columns, normalized like sheet names. The part mark is "Piesa" in the
 * Tekla export and "Reper" in the hand-made template.
 */
const PART_MARK_HEADERS = ['PIESA', 'REPER'];
const PART_COUNT_HEADER = 'NRTOTALDEREPERE';
const PART_WEIGHT_HEADER = 'MASATOTALAKG';

/** What an assembly's own row holds in the part column of the hand-made template. */
const ASSEMBLY_ROW_MARK = /^buc\.?$/i;

/** Uppercase, strip diacritics and anything that is not a letter or digit. */
function normalizeSheetName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Parts per ton the way the workbook counts its own "Nr. piese/to": every row
 * that names a part adds its "NR. TOTAL DE REPERE" and its "Masa totală (kg)".
 * Assembly rows name no part (or say "buc."), so they add nothing. Null when
 * the sheet is missing, laid out differently, or adds up to nothing — the
 * complexity is then typed in by hand, never guessed from the assembly count.
 */
function readWorkbookParts(workbook: ExcelJS.Workbook): WorkbookParts | null {
  const sheet = workbook.worksheets.find(
    (candidate) => normalizeSheetName(candidate.name) === PARTS_SHEET_NAME,
  );
  if (!sheet) {
    return null;
  }

  const rows = sheetToRows(sheet);
  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => normalizeSheetName(String(cell)) === PART_COUNT_HEADER),
  );
  if (headerIndex === -1) {
    return null;
  }

  const header = rows[headerIndex].map((cell) => normalizeSheetName(String(cell)));
  const markColumn = header.findIndex((name) => PART_MARK_HEADERS.includes(name));
  const countColumn = header.indexOf(PART_COUNT_HEADER);
  const weightColumn = header.indexOf(PART_WEIGHT_HEADER);
  if (markColumn === -1 || weightColumn === -1) {
    return null;
  }

  let pieces = 0;
  let weightKg = 0;
  for (const row of rows.slice(headerIndex + 1)) {
    const mark = String(row[markColumn] ?? '').trim();
    if (!mark || ASSEMBLY_ROW_MARK.test(mark)) {
      continue;
    }
    pieces += parseAssemblyNumber(row[countColumn] ?? '') ?? 0;
    weightKg += parseAssemblyNumber(row[weightColumn] ?? '') ?? 0;
  }

  return pieces > 0 && weightKg > 0 ? { pieces, weightKg } : null;
}

/**
 * Read an uploaded workbook and take the assembly list off the ANSAMBLE sheet.
 *
 * The sheet is found by name, not by guessing at content. A project workbook
 * has twenty-odd sheets and several of them mention assemblies — a parts
 * breakdown and a labels sheet both parse as plausible lists, and one can even
 * come out a row longer than the real one. Rather than pick a winner on a
 * heuristic, a workbook that does not have an ANSAMBLE sheet comes back with
 * its sheet names and no rows, so the admin says which one it is.
 *
 * The parts breakdown is added up alongside, whichever sheet the list came from.
 */
export async function readWorkbookPreview(
  buffer: Buffer,
  requestedSheet?: string,
): Promise<WorkbookPreview> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const sheets = workbook.worksheets.map((sheet) => sheet.name);

  const chosen = requestedSheet
    ? (workbook.worksheets.find((sheet) => sheet.name === requestedSheet) ?? null)
    : (workbook.worksheets.find(
        (sheet) => normalizeSheetName(sheet.name) === ASSEMBLY_SHEET_NAME,
      ) ?? null);

  return {
    sheets,
    rows: chosen ? sheetToRows(chosen) : [],
    sheetName: chosen?.name ?? null,
    parts: readWorkbookParts(workbook),
  };
}

import ExcelJS from 'exceljs';

/**
 * The cell's own value, not what Excel draws in it. The displayed text of a
 * length reads "2.982" where the value is 2981.6 — reading the file is only
 * worth doing if we take the number underneath.
 */
function cellToText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    if ('result' in value) {
      return cellToText((value as ExcelJS.CellFormulaValue).result ?? null);
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

function sheetToRows(sheet: ExcelJS.Worksheet): string[][] {
  const rows: string[][] = [];

  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      cells[columnNumber - 1] = cellToText(cell.value);
    });
    rows.push([...cells].map((cell) => cell ?? ''));
  });

  return rows;
}

export type WorkbookPreview = {
  /** Every sheet name in the workbook, in order. */
  sheets: string[];
  /** Cells of the chosen sheet, ready for parseAssemblyRows. Empty when none. */
  rows: string[][];
  sheetName: string | null;
};

/** The sheet a project workbook keeps its assembly list on. */
const ASSEMBLY_SHEET_NAME = 'ANSAMBLE';

/** Uppercase, strip diacritics and anything that is not a letter or digit. */
function normalizeSheetName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
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
  };
}

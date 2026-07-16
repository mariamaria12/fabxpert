import {
  hasTrailingDataRows,
  normalizePastedCell,
  parseTabSeparatedRows,
  pickDataRow,
} from '@/utils/parseExcelPaste';
import { parseDateDisplay } from '@fabxpert/shared';
import { normalizeSearchText } from '@/utils/searchText';

/** 1-based column indices from the offer-tracking spreadsheet. */
const COL = {
  startDate: 6,
  dueDate: 7,
  client: 8,
  code: 11,
  name: 13,
} as const;

const MIN_COLUMNS = COL.name;

export type ParsedExcelProjectValues = {
  name: string;
  code: string;
  clientName: string;
  startDate: string;
  dueDate: string;
  status: 'CIORNA';
};

export type ParseExcelProjectPasteResult =
  | {
      ok: true;
      values: ParsedExcelProjectValues;
      usedFirstRowOnly: boolean;
      extraColumnsIgnored: boolean;
    }
  | { ok: false; error: string };

function looksLikeProjectHeaderRow(cells: string[]): boolean {
  const joined = normalizeSearchText(cells.join('\t'));
  return joined.includes('nume folder') || joined.includes('data primirii');
}

function cellAt(cells: string[], oneBasedIndex: number): string {
  return cells[oneBasedIndex - 1] ?? '';
}

/** dd/MM/yyyy → yyyy-MM-dd for form state; invalid/empty → '' */
export function parseRomanianExcelDate(value: string): string {
  const normalized = normalizePastedCell(value);
  if (!normalized) {
    return '';
  }

  return parseDateDisplay(normalized) ?? '';
}

export function parseExcelProjectPaste(text: string): ParseExcelProjectPasteResult {
  const rows = parseTabSeparatedRows(text);
  const picked = pickDataRow(rows, looksLikeProjectHeaderRow);

  if (!picked) {
    return { ok: false, error: 'Nu am putut interpreta rândul copiat din Excel.' };
  }

  const { dataRow, dataRowIndex } = picked;

  if (dataRow.length < MIN_COLUMNS) {
    return { ok: false, error: 'Formatul nu corespunde — lipsesc coloane.' };
  }

  const name = normalizePastedCell(cellAt(dataRow, COL.name));
  const code = normalizePastedCell(cellAt(dataRow, COL.code));
  const clientName = normalizePastedCell(cellAt(dataRow, COL.client));

  if (!name && !code && !clientName) {
    return { ok: false, error: 'Nu am putut interpreta rândul copiat din Excel.' };
  }

  return {
    ok: true,
    values: {
      name,
      code,
      clientName,
      startDate: parseRomanianExcelDate(cellAt(dataRow, COL.startDate)),
      dueDate: parseRomanianExcelDate(cellAt(dataRow, COL.dueDate)),
      status: 'CIORNA',
    },
    usedFirstRowOnly: hasTrailingDataRows(rows, dataRowIndex),
    extraColumnsIgnored: dataRow.length > MIN_COLUMNS,
  };
}

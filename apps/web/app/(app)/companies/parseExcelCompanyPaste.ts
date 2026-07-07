const FIELD_KEYS = [
  'name',
  'taxCode',
  'tradeRegistryNumber',
  'registeredAddress',
  'phone',
  'deliveryAddress',
  'legalRepresentative',
  'email',
  'contactPerson',
  'contactPersonPhone',
] as const;

export type ExcelCompanyField = (typeof FIELD_KEYS)[number];

export type ExcelCompanyFormValues = Record<ExcelCompanyField, string>;

const KNOWN_HEADERS = [
  'denumire',
  'cod fiscal',
  'reg com',
  'sediul',
  'telefon',
  'adresa livrare',
  'reprezentant legal',
  'e-mail',
  'e mail',
  'poc',
  'tel poc',
];

function normalizeHeaderCell(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ');
}

export function normalizePastedCell(value: string): string {
  const trimmed = value.trim();
  const missingMarkers = new Set(['', '.', '-', '–', '—', 'N/A', 'n/a']);
  return missingMarkers.has(trimmed) ? '' : trimmed;
}

function looksLikeHeaderRow(cells: string[]): boolean {
  if (cells.length === 0) {
    return false;
  }

  const normalized = cells.map(normalizeHeaderCell);
  if (normalized[0] === 'denumire') {
    return true;
  }

  const matches = normalized.filter((cell) =>
    KNOWN_HEADERS.some(
      (header) => cell === header || cell.replace(/-/g, ' ') === header.replace(/-/g, ' '),
    ),
  ).length;

  return matches >= 2;
}

function parseRows(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split('\t').map((cell) => cell.trim()))
    .filter((row) => row.some((cell) => cell.length > 0));
}

export type ParseExcelCompanyPasteResult =
  | { ok: true; values: ExcelCompanyFormValues; extraColumnsIgnored: boolean }
  | { ok: false; error: string };

export function parseExcelCompanyPaste(text: string): ParseExcelCompanyPasteResult {
  const rows = parseRows(text);

  if (rows.length === 0) {
    return { ok: false, error: 'Nu am putut interpreta rândul copiat din Excel.' };
  }

  let dataRow = rows[0];
  if (looksLikeHeaderRow(rows[0])) {
    if (rows.length < 2) {
      return { ok: false, error: 'Nu am putut interpreta rândul copiat din Excel.' };
    }
    dataRow = rows[1];
  }

  const normalizedCells = dataRow.slice(0, 10).map((cell) => normalizePastedCell(cell ?? ''));
  const usefulColumns = normalizedCells.filter((cell) => cell.length > 0).length;
  if (usefulColumns < 2) {
    return { ok: false, error: 'Nu am putut interpreta rândul copiat din Excel.' };
  }

  const values = {} as ExcelCompanyFormValues;
  for (let index = 0; index < FIELD_KEYS.length; index += 1) {
    values[FIELD_KEYS[index]] = normalizedCells[index] ?? '';
  }

  return {
    ok: true,
    values,
    extraColumnsIgnored: dataRow.length > 10,
  };
}

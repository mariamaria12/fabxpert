export const COMPANY_IMPORT_FIELD_KEYS = [
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

export type CompanyImportFieldKey = (typeof COMPANY_IMPORT_FIELD_KEYS)[number];

export type CompanyImportRow = Record<CompanyImportFieldKey, string | undefined>;

const PLACEHOLDER_VALUES = new Set(['', '.', '-', '–', '—', 'N/A', 'n/a']);

/** Normalize a single pasted/import cell: trim, treat "." as empty. */
export function normalizeCompanyImportCell(value: string | undefined): string | undefined {
  const trimmed = (value ?? '').trim();
  if (PLACEHOLDER_VALUES.has(trimmed)) {
    return undefined;
  }
  return trimmed;
}

/**
 * Parse tab-separated company import text.
 * Supports quoted cells with embedded tabs/newlines (Excel copy format).
 */
export function parseCompanyImportTsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === '\t') {
      row.push(cell);
      cell = '';
      continue;
    }

    if (char === '\n' || (char === '\r' && next === '\n')) {
      if (char === '\r') {
        index += 1;
      }
      row.push(cell);
      cell = '';
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    if (char !== '\r') {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.length > 0)) {
    rows.push(row);
  }

  return rows;
}

export function rawRowToCompanyImportRow(cells: string[]): CompanyImportRow | null {
  const normalized = cells.slice(0, COMPANY_IMPORT_FIELD_KEYS.length).map((cell) =>
    normalizeCompanyImportCell(cell),
  );

  const name = normalized[0];
  if (!name) {
    return null;
  }

  const row = {} as CompanyImportRow;
  for (let index = 0; index < COMPANY_IMPORT_FIELD_KEYS.length; index += 1) {
    row[COMPANY_IMPORT_FIELD_KEYS[index]] = normalized[index];
  }
  return row;
}

export function parseCompanyImportRows(text: string): CompanyImportRow[] {
  const rows: CompanyImportRow[] = [];

  for (const rawRow of parseCompanyImportTsv(text)) {
    const parsed = rawRowToCompanyImportRow(rawRow);
    if (parsed) {
      rows.push(parsed);
    }
  }

  return rows;
}

export function normalizePastedCell(value: string): string {
  const trimmed = value.trim();
  const missingMarkers = new Set(['', '.', '-', '–', '—', 'N/A', 'n/a']);
  return missingMarkers.has(trimmed) ? '' : trimmed;
}

export function parseTabSeparatedRows(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split('\t').map((cell) => cell.trim()))
    .filter((row) => row.some((cell) => cell.length > 0));
}

export function pickDataRow(
  rows: string[][],
  looksLikeHeaderRow: (cells: string[]) => boolean,
): { dataRow: string[]; dataRowIndex: number } | null {
  if (rows.length === 0) {
    return null;
  }

  let dataRowIndex = 0;
  if (looksLikeHeaderRow(rows[0])) {
    if (rows.length < 2) {
      return null;
    }
    dataRowIndex = 1;
  }

  return { dataRow: rows[dataRowIndex], dataRowIndex };
}

export function hasTrailingDataRows(rows: string[][], dataRowIndex: number): boolean {
  return rows.length > dataRowIndex + 1;
}

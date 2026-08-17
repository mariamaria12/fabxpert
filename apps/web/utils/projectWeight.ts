const weightFormat = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 });

/** Table display, e.g. "1.234,5 kg". */
export function formatProjectWeight(weight: number): string {
  return `${weightFormat.format(weight)} kg`;
}

export type ParsedWeight = { ok: true; value: number | null } | { ok: false };

/**
 * Form input to payload value. Blank means "not filled in" (null), and both the
 * Romanian and the English decimal separator are accepted.
 */
export function parseWeightInput(raw: string): ParsedWeight {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: true, value: null };
  }

  const value = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(value) || value < 0) {
    return { ok: false };
  }

  return { ok: true, value };
}

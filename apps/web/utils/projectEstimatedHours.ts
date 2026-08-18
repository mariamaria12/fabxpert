const estimatedHoursFormat = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 });

/** Table display, e.g. "120,5 h". */
export function formatProjectEstimatedHours(hours: number): string {
  return `${estimatedHoursFormat.format(hours)} h`;
}

export type ParsedEstimatedHours = { ok: true; value: number | null } | { ok: false };

/**
 * Form input to payload value. Blank means "not filled in" (null), and both the
 * Romanian and the English decimal separator are accepted.
 */
export function parseEstimatedHoursInput(raw: string): ParsedEstimatedHours {
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

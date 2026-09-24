export type ParsedDecimalInput = { ok: true; value: number | null } | { ok: false };

/**
 * A non-negative number typed into a form field. Blank means "not filled in"
 * (null), and both the Romanian and the English decimal separator are accepted.
 */
export function parseDecimalInput(raw: string): ParsedDecimalInput {
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

const tonnesFormat = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 });

const KG_PER_TONNE = 1000;

/** Kilograms as tonnes for reading, e.g. "12,35 t". */
export function formatProjectWeight(weightKg: number): string {
  return `${tonnesFormat.format(weightKg / KG_PER_TONNE)} t`;
}

/** Kilograms as the tonnes figure a form field holds — no unit, kilogram precision. */
export function weightKgToInput(weightKg: number | null): string {
  if (weightKg === null) {
    return '';
  }
  return String(Math.round(weightKg) / KG_PER_TONNE);
}

export type ParsedWeight = { ok: true; value: number | null } | { ok: false };

/**
 * Tonnes typed into the form, to the kilograms the API stores. Blank means
 * "not filled in" (null), and both the Romanian and the English decimal
 * separator are accepted.
 */
export function parseWeightInput(raw: string): ParsedWeight {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: true, value: null };
  }

  const tonnes = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(tonnes) || tonnes < 0) {
    return { ok: false };
  }

  return { ok: true, value: Math.round(tonnes * KG_PER_TONNE) };
}

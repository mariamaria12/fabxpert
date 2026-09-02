/**
 * Profile designations reach us however the draughtsman typed them:
 * "CFCHS48.3*3.6", "CFCHS 48.3x3.6" and "CFCHS48,3X3,6" are one profile.
 * The key is what we group and look up by; the original spelling is kept for
 * display, because that is what the worker reads on the drawing.
 *
 * Rolled sections (HEA280, IPE600) come from a finite catalogue, but plates
 * (PL8x90) are grabbed from stock in any thickness × width — so this normalizes
 * rather than validates. An unknown profile is never an error.
 */
export function normalizeProfileKey(profile: string): string {
  return profile
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/,/g, '.')
    .replace(/[*×]/g, 'X')
    .replace(/^[^A-Z0-9]+|[^A-Z0-9.]+$/g, '');
}

/** Null-safe wrapper: blank or missing input yields no key. */
export function toProfileKey(profile: string | null | undefined): string | null {
  if (!profile) {
    return null;
  }
  const key = normalizeProfileKey(profile);
  return key.length > 0 ? key : null;
}

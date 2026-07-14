import { COLOR_PRESETS } from '@/components/ColorField';

/** Decorative UI-only palette for employee roles (not persisted). */
export const ROLE_UI_PALETTE = [
  ...COLOR_PRESETS,
  '#6B7C3F',
  '#4A6670',
  '#7A4E68',
  '#5C4A7A',
  '#8B6914',
] as const;

export function getRolePaletteColor(stableIndex: number): string {
  return ROLE_UI_PALETTE[stableIndex % ROLE_UI_PALETTE.length];
}

const TEXT_ON_LIGHT_SWATCH = '#2B2107';
const TEXT_ON_DARK_SWATCH = 'var(--color-text-primary)';

/** Readable label/icon color on a solid swatch background. */
export function contrastTextOnHex(hex: string): string {
  const normalized = hex.toUpperCase();
  const r = Number.parseInt(normalized.slice(1, 3), 16);
  const g = Number.parseInt(normalized.slice(3, 5), 16);
  const b = Number.parseInt(normalized.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? TEXT_ON_LIGHT_SWATCH : TEXT_ON_DARK_SWATCH;
}

export function compareStableLookupOrder(
  left: { id: string; createdAt: string },
  right: { id: string; createdAt: string },
): number {
  const byCreatedAt = left.createdAt.localeCompare(right.createdAt);
  if (byCreatedAt !== 0) {
    return byCreatedAt;
  }
  return left.id.localeCompare(right.id);
}

export function buildStableIndexMap<T extends { id: string; createdAt: string }>(
  items: T[],
): Map<string, number> {
  const sorted = [...items].sort(compareStableLookupOrder);
  const map = new Map<string, number>();

  sorted.forEach((item, index) => {
    map.set(item.id, index);
  });

  return map;
}

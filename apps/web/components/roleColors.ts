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

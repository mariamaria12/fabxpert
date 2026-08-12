// Colors for the Rapoarte charts. Semantic tokens (theme-aware) for KPIs and
// on-time/late; a fixed hue palette for multi-series bars where an entity has no
// color of its own.

export const TOKEN = {
  accent: 'var(--color-accent)',
  success: 'var(--color-success-icon)',
  danger: 'var(--color-danger-text)',
  muted: 'var(--color-text-muted)',
  info: '#60a5fa',
} as const;

/** Distinct hues cycled for client/activity bars without an assigned color. */
export const CHART_PALETTE = [
  '#d9a441',
  '#60a5fa',
  '#86efac',
  '#c084fc',
  '#f0a868',
  '#5ed0c5',
  '#f472b6',
  '#a3e635',
] as const;

export function paletteColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length];
}

/** Translucent tint of a color, for icon boxes and bar tracks. */
export function tint(color: string, mix = '22%'): string {
  return `color-mix(in srgb, ${color} ${mix}, transparent)`;
}

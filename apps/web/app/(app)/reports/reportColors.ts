// Colors for the Rapoarte charts, all read from tokens.css: semantic tokens for
// KPIs and on-time/late, and the --chart-N hues for multi-series bars where an
// entity has no color of its own.

export const TOKEN = {
  accent: 'var(--color-accent)',
  success: 'var(--color-success-icon)',
  danger: 'var(--color-danger-text)',
  muted: 'var(--color-text-muted)',
  info: 'var(--color-info)',
} as const;

/** Distinct hues cycled for client/activity bars without an assigned color. */
export const CHART_PALETTE = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
] as const;

export function paletteColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length];
}

/** Translucent tint of a color, for icon boxes and bar tracks. */
export function tint(color: string, mix = '22%'): string {
  return `color-mix(in srgb, ${color} ${mix}, transparent)`;
}

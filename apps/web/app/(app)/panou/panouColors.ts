/** Accent used when a project or metric has no color of its own. */
export const NEUTRAL_ACCENT = 'var(--color-text-muted)';

/** Tinted background from an accent color (for icon boxes, accents). */
export function panouAccentTint(color: string | null, mix = '22%'): string {
  const base = color ?? NEUTRAL_ACCENT;
  return `color-mix(in srgb, ${base} ${mix}, transparent)`;
}

export const PANOU_METRIC_THEMES = {
  projects: { accent: 'var(--color-metric-projects)', icon: 'ti-clipboard-list', label: 'Active acum' },
  hours: { accent: 'var(--color-metric-hours)', icon: 'ti-clock', label: 'Astăzi' },
  people: { accent: 'var(--color-metric-people)', icon: 'ti-users', label: 'Utilizatori' },
  onLeave: { accent: 'var(--color-metric-on-leave)', icon: 'ti-calendar-off', label: 'Utilizatori' },
  notLogged: { accent: 'var(--color-metric-not-logged)', icon: 'ti-clock-off', label: 'Utilizatori' },
} as const;

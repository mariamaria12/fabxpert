/** Tinted background from a project hex color (for icon boxes, accents). */
export function panouAccentTint(color: string | null, mix = '22%'): string {
  const base = color ?? '#8c8a80';
  return `color-mix(in srgb, ${base} ${mix}, transparent)`;
}

export const PANOU_METRIC_THEMES = {
  projects: { accent: '#a78bfa', icon: 'ti-clipboard-list', label: 'Active acum' },
  hours: { accent: '#60a5fa', icon: 'ti-clock', label: 'Astăzi' },
  people: { accent: '#86efac', icon: 'ti-users', label: 'Utilizatori' },
  onLeave: { accent: '#fbbf24', icon: 'ti-calendar-off', label: 'Utilizatori' },
} as const;

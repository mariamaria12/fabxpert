/** Pill chips for the filter rows above a list (period, leave status). */
export function filterChipClassName(selected: boolean): string {
  return `inline-flex items-baseline gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
    selected
      ? 'border-accent/40 bg-accent/10 text-accent'
      : 'border-border bg-surface text-text-secondary hover:bg-surface-raised hover:text-text-primary'
  }`;
}

/** Chevron that reveals the chips kept off the row on phones. */
export const FILTER_CHIP_TOGGLE_CLASS =
  'inline-flex size-7 items-center justify-center rounded-full border border-border bg-surface text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary';

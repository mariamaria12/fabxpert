export const FORM_LABEL_CLASS = 'mb-1.5 block text-xs font-medium text-text-secondary';

export const FORM_FIELD_CLASS =
  'w-full rounded-md border border-border bg-surface-raised px-3 py-[10px] text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

export const FORM_COMBO_INPUT_CLASS =
  'w-full min-h-[42px] rounded-md border border-border bg-surface-raised py-2.5 pl-3 pr-10 text-sm text-text-primary placeholder:text-text-muted transition-colors hover:border-text-muted/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-60';

export const FORM_SELECT_CLASS = `${FORM_FIELD_CLASS} appearance-none pr-9`;

export const FORM_DROPDOWN_CLASS =
  'fixed z-[60] overflow-y-auto rounded-lg border border-strong bg-surface-popover py-1.5 shadow-popover';

export const FORM_DROPDOWN_EMPTY_CLASS = 'px-3 py-2.5 text-sm text-text-secondary';

export function formDropdownOptionClass(isHighlighted: boolean, isSelected = false): string {
  const base =
    'relative flex min-h-[40px] w-full items-center gap-2 border-l-[3px] py-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50';

  if (isHighlighted) {
    return `${base} border-accent bg-[var(--color-accent-tint-strong)] pl-[calc(0.75rem-3px)] pr-3 text-text-primary`;
  }

  if (isSelected) {
    return `${base} border-transparent bg-[var(--color-accent-tint)] pl-[calc(0.75rem-3px)] pr-3 text-text-primary hover:bg-[var(--color-surface-popover-hover)]`;
  }

  return `${base} border-transparent px-3 text-text-primary hover:bg-[var(--color-surface-popover-hover)]`;
}

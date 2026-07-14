export const FORM_LABEL_CLASS = 'mb-1.5 block text-xs font-medium text-text-secondary';

export const FORM_FIELD_CLASS =
  'w-full rounded-md border border-border bg-surface-raised px-3 py-[10px] text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

export const FORM_COMBO_INPUT_CLASS =
  'w-full min-h-[42px] rounded-md border border-border bg-surface-raised py-2.5 pl-3 pr-10 text-sm text-text-primary placeholder:text-text-muted transition-colors hover:border-text-muted/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-60';

export const FORM_SELECT_CLASS = `${FORM_FIELD_CLASS} appearance-none pr-9`;

export const FORM_DROPDOWN_CLASS =
  'fixed z-[60] overflow-y-auto rounded-md border border-border bg-surface py-1 shadow-lg ring-1 ring-border-subtle';

export function formDropdownOptionClass(isHighlighted: boolean): string {
  return `flex min-h-[40px] w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
    isHighlighted
      ? 'bg-accent/15 text-accent'
      : 'text-text-primary hover:bg-surface-raised'
  }`;
}

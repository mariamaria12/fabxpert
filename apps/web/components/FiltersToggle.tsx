'use client';

/**
 * Phone-only show/hide control for a list's search + filters. Pages render it
 * in their header row so it lines up with the primary action button.
 */
export function FiltersToggle({
  open,
  onToggle,
  className,
}: {
  open: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={`inline-flex items-center gap-1 text-xs font-medium text-accent transition-opacity hover:opacity-80 ${className ?? ''}`}
    >
      <i className="ti ti-filter text-sm" aria-hidden="true" />
      {open ? 'Ascunde filtrele' : 'Afișează filtrele'}
      <i
        className={`ti ${open ? 'ti-chevron-up' : 'ti-chevron-down'} text-sm`}
        aria-hidden="true"
      />
    </button>
  );
}

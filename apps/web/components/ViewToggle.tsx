'use client';

export type ViewOption<T extends string> = { id: T; label: string; icon: string };

export const TABLE_CALENDAR_VIEWS = [
  { id: 'table', label: 'Tabel', icon: 'ti-table' },
  { id: 'calendar', label: 'Calendar', icon: 'ti-calendar-month' },
] as const satisfies readonly ViewOption<string>[];

export type TableCalendarView = (typeof TABLE_CALENDAR_VIEWS)[number]['id'];

export const TABLE_CALENDAR_VIEW_IDS: readonly TableCalendarView[] = TABLE_CALENDAR_VIEWS.map(
  (option) => option.id,
);

interface ViewToggleProps<T extends string> {
  options: readonly ViewOption<T>[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
}

/** Segmented switch between the views of one list. Labels hide on phones. */
export function ViewToggle<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: ViewToggleProps<T>) {
  return (
    <div
      role="group"
      aria-label="Vizualizare"
      className={`inline-flex rounded-md border border-border p-0.5 ${className}`}
    >
      {options.map((option) => {
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            aria-label={option.label}
            title={option.label}
            onClick={() => onChange(option.id)}
            className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              selected
                ? 'bg-surface-raised text-text-primary'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <i className={`ti ${option.icon} text-sm`} aria-hidden="true" />
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

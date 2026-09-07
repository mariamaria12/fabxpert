'use client';

import { formatMonthRange, shiftMonth } from './timesheetMonths';

interface MonthPickerProps {
  value: string;
  onChange: (month: string) => void;
  /** Latest month that can be picked, as `YYYY-MM`. */
  max?: string;
  disabled?: boolean;
}

const arrowClassName =
  'flex h-9 w-9 items-center justify-center text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40';

/** Previous / next arrows around the month, shown as its full date range. */
export function MonthPicker({ value, onChange, max, disabled = false }: MonthPickerProps) {
  const atMax = max !== undefined && value >= max;

  return (
    <div className="inline-flex items-stretch overflow-hidden rounded-md border border-border bg-surface">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(shiftMonth(value, -1))}
        aria-label="Luna anterioară"
        title="Luna anterioară"
        className={arrowClassName}
      >
        <i className="ti ti-chevron-left text-base" aria-hidden="true" />
      </button>
      <label className="flex items-center border-x border-border px-3 text-sm font-medium tabular-nums text-text-primary">
        <span className="sr-only">Luna</span>
        <input
          type="month"
          value={value}
          max={max}
          disabled={disabled}
          onChange={(event) => {
            if (event.target.value) {
              onChange(event.target.value);
            }
          }}
          className="sr-only"
        />
        {formatMonthRange(value)}
      </label>
      <button
        type="button"
        disabled={disabled || atMax}
        onClick={() => onChange(shiftMonth(value, 1))}
        aria-label="Luna următoare"
        title="Luna următoare"
        className={arrowClassName}
      >
        <i className="ti ti-chevron-right text-base" aria-hidden="true" />
      </button>
    </div>
  );
}

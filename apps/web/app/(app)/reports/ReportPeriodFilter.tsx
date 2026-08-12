'use client';

import { reportPeriodsEqual, type ReportPeriod } from '@fabxpert/shared';
import { useEffect, useRef, useState } from 'react';
import { DateField } from '@/components/DateField';

const dateInputClassName =
  'rounded-md border border-border bg-surface-raised px-3 py-1.5 font-mono text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

type PresetKind = 'lastMonth' | 'currentMonth';

const PRESETS: { kind: PresetKind; label: string }[] = [
  { kind: 'lastMonth', label: 'Luna trecută' },
  { kind: 'currentMonth', label: 'Luna curentă' },
];

export type ReportPeriodFilterProps = {
  value: ReportPeriod;
  onChange: (period: ReportPeriod) => void;
  className?: string;
};

export function ReportPeriodFilter({ value, onChange, className }: ReportPeriodFilterProps) {
  const [customMode, setCustomMode] = useState(false);
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);
  const customRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value.kind === 'custom') {
      setDraftFrom(value.from);
      setDraftTo(value.to);
      setCustomMode(false);
    }
  }, [value]);

  // The range inputs float over the page, so they close like any other popover.
  useEffect(() => {
    if (!customMode) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (customRef.current?.contains(event.target as Node)) {
        return;
      }
      setCustomMode(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setCustomMode(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [customMode]);

  function selectPreset(kind: PresetKind) {
    setCustomMode(false);
    setCustomError(null);
    onChange({ kind });
  }

  function applyCustomRange() {
    if (!draftFrom || !draftTo) {
      setCustomError('Selectează ambele date.');
      return;
    }
    if (draftFrom > draftTo) {
      setCustomError('Data de început trebuie să fie înainte sau egală cu data de sfârșit.');
      return;
    }

    const next: ReportPeriod = { kind: 'custom', from: draftFrom, to: draftTo };
    setCustomError(null);
    setCustomMode(false);
    if (!reportPeriodsEqual(value, next)) {
      onChange(next);
    }
  }

  const chipClassName = (selected: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
      selected
        ? 'border-accent/40 bg-accent/10 text-accent'
        : 'border-border bg-surface text-text-secondary hover:bg-surface-raised hover:text-text-primary'
    }`;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map((preset) => {
          const selected = value.kind === preset.kind;
          return (
            <button
              key={preset.kind}
              type="button"
              aria-pressed={selected}
              onClick={() => selectPreset(preset.kind)}
              className={chipClassName(selected)}
            >
              <span className="font-medium">{preset.label}</span>
            </button>
          );
        })}

        <div className="relative" ref={customRef}>
          <button
            type="button"
            aria-pressed={value.kind === 'custom'}
            aria-expanded={customMode}
            onClick={() => {
              if (customMode) {
                setCustomMode(false);
                return;
              }
              setCustomMode(true);
              setCustomError(null);
            }}
            className={chipClassName(value.kind === 'custom' || customMode)}
          >
            <i className="ti ti-calendar-event text-sm" aria-hidden="true" />
            <span className="font-medium">Interval</span>
          </button>

          {customMode && (
            <div className="absolute left-0 top-full z-30 mt-1.5 w-max rounded-lg border border-strong bg-surface-popover p-3 shadow-popover">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <DateField
                  id="report-period-from"
                  label="De la"
                  value={draftFrom}
                  className={dateInputClassName}
                  onChange={(next) => {
                    setDraftFrom(next);
                    setCustomError(null);
                  }}
                />
                <DateField
                  id="report-period-to"
                  label="Până la"
                  value={draftTo}
                  className={dateInputClassName}
                  onChange={(next) => {
                    setDraftTo(next);
                    setCustomError(null);
                  }}
                />
                <button
                  type="button"
                  onClick={applyCustomRange}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90"
                >
                  Aplică
                </button>
              </div>
              {customError && <p className="mt-2 text-xs text-danger">{customError}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

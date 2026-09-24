'use client';

import { reportPeriodsEqual, type ReportPeriod } from '@fabxpert/shared';
import { useEffect, useRef, useState } from 'react';
import { DateRangeCalendar } from '@/components/DateRangeCalendar';
import { filterChipClassName } from '@/components/filterChipStyles';

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
  const customRef = useRef<HTMLDivElement>(null);

  // The range calendar floats over the page, so they close like any other popover.
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
    onChange({ kind });
  }

  function applyCustomRange(from: string, to: string) {
    const next: ReportPeriod = { kind: 'custom', from, to };
    setCustomMode(false);
    if (!reportPeriodsEqual(value, next)) {
      onChange(next);
    }
  }

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
              className={filterChipClassName(selected)}
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
              setCustomMode(!customMode);
            }}
            className={filterChipClassName(value.kind === 'custom' || customMode)}
          >
            <i className="ti ti-calendar-event text-sm" aria-hidden="true" />
            <span className="font-medium">Interval</span>
          </button>

          {customMode && (
            <>
              {/* Phones get a centred dialog over a dimmed page: <main> clips
                  anything anchored to the chip with overflow-x-hidden. */}
              <div
                className="fixed inset-0 z-40 bg-bg/70 sm:hidden"
                onClick={() => setCustomMode(false)}
                aria-hidden="true"
              />
              <div className="fixed left-1/2 top-1/2 z-50 w-max -translate-x-1/2 -translate-y-1/2 rounded-lg border border-strong bg-surface-popover p-3 shadow-popover sm:absolute sm:left-auto sm:right-0 sm:top-full sm:z-30 sm:mt-1.5 sm:translate-x-0 sm:translate-y-0">
                <DateRangeCalendar
                  from={value.kind === 'custom' ? value.from : ''}
                  to={value.kind === 'custom' ? value.to : ''}
                  onSelect={applyCustomRange}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import {
  formatPeriodCardSubLabel,
  periodsEqual,
  type Period,
} from '@fabxpert/shared';
import { useEffect, useRef, useState } from 'react';
import { DateRangeCalendar } from '@/components/DateRangeCalendar';
import {
  filterChipClassName,
  FILTER_CHIP_TOGGLE_CLASS,
} from '@/components/filterChipStyles';
import { useIsMobile } from '@/hooks/useIsMobile';

type PeriodKind = Period['kind'];

const PERIOD_CARDS: { kind: PeriodKind; label: string }[] = [
  { kind: 'today', label: 'Azi' },
  { kind: 'yesterday', label: 'Ieri' },
  { kind: 'week', label: 'Săpt.' },
  { kind: 'month', label: 'Luna' },
  { kind: 'custom', label: 'Interval' },
];

function isCardSelected(value: Period, kind: PeriodKind, customMode: boolean): boolean {
  if (kind === 'custom') {
    return value.kind === 'custom' || customMode;
  }

  return value.kind === kind && !customMode;
}

function cardSubLabel(kind: PeriodKind, value: Period, now: Date): string {
  if (kind === 'custom') {
    return value.kind === 'custom'
      ? formatPeriodCardSubLabel('custom', now, { from: value.from, to: value.to })
      : formatPeriodCardSubLabel('custom', now);
  }

  return formatPeriodCardSubLabel(kind, now);
}

export type PeriodFilterProps = {
  value: Period;
  onChange: (period: Period) => void;
  className?: string;
};

export function PeriodFilter({ value, onChange, className }: PeriodFilterProps) {
  const [now, setNow] = useState(() => new Date());
  const [customMode, setCustomMode] = useState(false);
  const customRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [showAllPeriods, setShowAllPeriods] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

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

  function selectPreset(kind: 'today' | 'yesterday' | 'week' | 'month') {
    setCustomMode(false);
    onChange({ kind });
  }

  function applyCustomRange(from: string, to: string) {
    setCustomMode(false);
    const next: Period = { kind: 'custom', from, to };
    if (!periodsEqual(value, next)) {
      onChange(next);
    }
  }

  // Phones show only "Azi" and "Ieri" (plus whatever is selected); the rest sit
  // behind the chevron so the row never wraps.
  const collapsed = isMobile && !showAllPeriods;
  const visibleCards = collapsed
    ? PERIOD_CARDS.filter(
        (card) =>
          card.kind === 'today' ||
          card.kind === 'yesterday' ||
          isCardSelected(value, card.kind, customMode),
      )
    : PERIOD_CARDS;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-1.5">
        {visibleCards.map((card) => {
          const selected = isCardSelected(value, card.kind, customMode);
          const chip = (
            <button
              type="button"
              aria-pressed={selected}
              aria-expanded={card.kind === 'custom' ? customMode : undefined}
              onClick={() => {
                if (card.kind === 'custom') {
                  setCustomMode(!customMode);
                  return;
                }
                selectPreset(card.kind);
              }}
              className={filterChipClassName(selected)}
            >
              <span className="font-medium">{card.label}</span>
              <span className={selected ? 'text-accent/80' : 'text-text-muted'}>
                {cardSubLabel(card.kind, value, now)}
              </span>
            </button>
          );

          if (card.kind !== 'custom') {
            return <div key={card.kind}>{chip}</div>;
          }

          // Floated over the page so opening the range picker shifts nothing.
          return (
            <div key={card.kind} className="relative" ref={customRef}>
              {chip}

              {customMode && (
                <>
                  {/* Phones get a centred dialog over a dimmed page: <main> clips
                      anything anchored to the chip with overflow-x-hidden. */}
                  <div
                    className="fixed inset-0 z-40 bg-bg/70 sm:hidden"
                    onClick={() => setCustomMode(false)}
                    aria-hidden="true"
                  />
                  <div className="fixed left-1/2 top-1/2 z-50 w-max -translate-x-1/2 -translate-y-1/2 rounded-lg border border-strong bg-surface-popover p-3 shadow-popover sm:absolute sm:left-0 sm:top-full sm:z-30 sm:mt-1.5 sm:translate-x-0 sm:translate-y-0">
                    <DateRangeCalendar
                      from={value.kind === 'custom' ? value.from : ''}
                      to={value.kind === 'custom' ? value.to : ''}
                      onSelect={applyCustomRange}
                    />
                  </div>
                </>
              )}
            </div>
          );
        })}

        {isMobile && (
          <button
            type="button"
            onClick={() => setShowAllPeriods((current) => !current)}
            aria-expanded={showAllPeriods}
            aria-label={
              showAllPeriods ? 'Ascunde celelalte perioade' : 'Afișează celelalte perioade'
            }
            className={FILTER_CHIP_TOGGLE_CLASS}
          >
            <i
              className={`ti ${showAllPeriods ? 'ti-chevron-up' : 'ti-chevron-down'} text-base`}
              aria-hidden="true"
            />
          </button>
        )}
      </div>
    </div>
  );
}

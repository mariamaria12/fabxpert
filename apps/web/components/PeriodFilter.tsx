'use client';

import {
  formatPeriodCardSubLabel,
  periodsEqual,
  type Period,
} from '@fabxpert/shared';
import { useEffect, useRef, useState } from 'react';
import { DateField } from '@/components/DateField';
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

const dateInputClassName =
  'rounded-md border border-border bg-surface-raised px-3 py-1.5 font-mono text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

function isCardSelected(value: Period, kind: PeriodKind, customMode: boolean): boolean {
  if (kind === 'custom') {
    return value.kind === 'custom' || customMode;
  }

  return value.kind === kind && !customMode;
}

function cardSubLabel(
  kind: PeriodKind,
  value: Period,
  customMode: boolean,
  draftFrom: string,
  draftTo: string,
  now: Date,
): string {
  if (kind === 'custom') {
    if (value.kind === 'custom' && !customMode) {
      return formatPeriodCardSubLabel('custom', now, {
        from: value.from,
        to: value.to,
      });
    }

    if (draftFrom && draftTo) {
      return formatPeriodCardSubLabel('custom', now, {
        from: draftFrom,
        to: draftTo,
      });
    }

    return formatPeriodCardSubLabel('custom', now);
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
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);
  const customRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [showAllPeriods, setShowAllPeriods] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

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

  useEffect(() => {
    if (value.kind === 'custom') {
      setDraftFrom(value.from);
      setDraftTo(value.to);
      setCustomMode(false);
    }
  }, [value]);

  function selectPreset(kind: 'today' | 'yesterday' | 'week' | 'month') {
    setCustomMode(false);
    setCustomError(null);
    onChange({ kind });
  }

  function selectCustom() {
    setCustomMode(true);
    setCustomError(null);
    if (value.kind === 'custom') {
      setDraftFrom(value.from);
      setDraftTo(value.to);
    }
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

    const next: Period = { kind: 'custom', from: draftFrom, to: draftTo };
    if (periodsEqual(value, next)) {
      setCustomMode(false);
      setCustomError(null);
      return;
    }

    setCustomError(null);
    setCustomMode(false);
    onChange(next);
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
                  if (customMode) {
                    setCustomMode(false);
                    return;
                  }
                  selectCustom();
                  return;
                }
                selectPreset(card.kind);
              }}
              className={filterChipClassName(selected)}
            >
              <span className="font-medium">{card.label}</span>
              <span className={selected ? 'text-accent/80' : 'text-text-muted'}>
                {cardSubLabel(card.kind, value, customMode, draftFrom, draftTo, now)}
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
                <div className="absolute left-0 top-full z-30 mt-1.5 w-max rounded-lg border border-strong bg-surface-popover p-3 shadow-popover">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <DateField
                      id="period-filter-from"
                      label="De la"
                      value={draftFrom}
                      className={dateInputClassName}
                      onChange={(value) => {
                        setDraftFrom(value);
                        setCustomError(null);
                      }}
                    />
                    <DateField
                      id="period-filter-to"
                      label="Până la"
                      value={draftTo}
                      className={dateInputClassName}
                      onChange={(value) => {
                        setDraftTo(value);
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
                  {customError && (
                    <p className="mt-2 text-xs text-danger">{customError}</p>
                  )}
                </div>
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

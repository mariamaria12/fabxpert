'use client';

import {
  formatPeriodCardSubLabel,
  periodsEqual,
  type Period,
} from '@fabxpert/shared';
import { useEffect, useState } from 'react';

type PeriodKind = Period['kind'];

const PERIOD_CARDS: { kind: PeriodKind; label: string }[] = [
  { kind: 'today', label: 'Azi' },
  { kind: 'week', label: 'Săptămâna' },
  { kind: 'month', label: 'Luna' },
  { kind: 'custom', label: 'Interval' },
];

const dateInputClassName =
  'rounded-md border border-border bg-surface-raised px-3 py-1.5 font-mono text-sm text-text-primary [color-scheme:dark] focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

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

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (value.kind === 'custom') {
      setDraftFrom(value.from);
      setDraftTo(value.to);
      setCustomMode(false);
    }
  }, [value]);

  function selectPreset(kind: 'today' | 'week' | 'month') {
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

  return (
    <div className={className}>
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
          {PERIOD_CARDS.map((card) => {
            const selected = isCardSelected(value, card.kind, customMode);
            return (
              <button
                key={card.kind}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  if (card.kind === 'custom') {
                    selectCustom();
                    return;
                  }
                  selectPreset(card.kind);
                }}
                className={`flex min-h-[4.5rem] flex-col items-start rounded-md border px-4 py-3 text-left transition-colors ${
                  selected
                    ? 'border-accent/30 bg-accent/10'
                    : 'border-border-subtle bg-surface hover:bg-surface-raised'
                }`}
              >
                <span
                  className={`text-sm font-medium ${
                    selected ? 'text-accent' : 'text-text-secondary'
                  }`}
                >
                  {card.label}
                </span>
                <span
                  className={`mt-1 text-xs ${
                    selected ? 'text-accent/80' : 'text-text-muted'
                  }`}
                >
                  {cardSubLabel(card.kind, value, customMode, draftFrom, draftTo, now)}
                </span>
              </button>
            );
          })}
        </div>

        {customMode && (
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end lg:w-auto">
            <div>
              <label htmlFor="period-filter-from" className="mb-1.5 block text-xs text-text-secondary">
                De la
              </label>
              <input
                id="period-filter-from"
                type="date"
                value={draftFrom}
                onChange={(event) => {
                  setDraftFrom(event.target.value);
                  setCustomError(null);
                }}
                className={dateInputClassName}
              />
            </div>
            <div>
              <label htmlFor="period-filter-to" className="mb-1.5 block text-xs text-text-secondary">
                Până la
              </label>
              <input
                id="period-filter-to"
                type="date"
                value={draftTo}
                onChange={(event) => {
                  setDraftTo(event.target.value);
                  setCustomError(null);
                }}
                className={dateInputClassName}
              />
            </div>
            <button
              type="button"
              onClick={applyCustomRange}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90"
            >
              Aplică
            </button>
            {customError && (
              <p className="w-full text-xs text-danger sm:order-last">{customError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

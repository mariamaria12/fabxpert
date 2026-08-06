'use client';

import { PeriodFilter } from '@/components/PeriodFilter';
import { usePanouDashboard } from './PanouDashboardContext';

const READY_OPTIONS: { value: boolean | null; label: string; accent: string }[] = [
  { value: null, label: 'Toate', accent: 'var(--color-accent)' },
  { value: true, label: 'Da', accent: 'var(--color-success-icon)' },
  { value: false, label: 'Nu', accent: 'var(--color-danger-text)' },
];

/**
 * Single row under the metric cards: period chips plus — on the projects view —
 * the "gata de execuție" filter, so the tables start as high as possible.
 */
export function PanouToolbar() {
  const { activeView, period, setPeriod, readyForExecution, setReadyForExecution } =
    usePanouDashboard();

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
      <PeriodFilter value={period} onChange={setPeriod} />

      {activeView === 'projects' && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-text-secondary">Gata de execuție</span>
          {READY_OPTIONS.map((option) => {
            const selected = readyForExecution === option.value;

            return (
              <button
                key={option.label}
                type="button"
                aria-pressed={selected}
                onClick={() => setReadyForExecution(option.value)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  selected
                    ? 'border-transparent'
                    : 'border-border bg-surface text-text-secondary hover:bg-surface-raised hover:text-text-primary'
                }`}
                style={
                  selected
                    ? {
                        backgroundColor: `color-mix(in srgb, ${option.accent} 18%, transparent)`,
                        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${option.accent} 45%, transparent)`,
                        color: option.accent,
                      }
                    : undefined
                }
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

'use client';

import {
  formatPeriodLabel,
  getDashboardMetrics,
  type DashboardMetricsResponse,
  type Period,
} from '@fabxpert/shared';
import { useCallback, useEffect, useState } from 'react';
import { formatDurationMinutes } from '@/app/(app)/timesheets/timesheetFormat';
import { useRegisterPanouRefetch } from '../PanouRefreshContext';
import { usePanouDashboard, type PanouView } from './PanouDashboardContext';
import { PANOU_METRIC_THEMES, panouAccentTint } from './panouColors';

/** "azi", "săptămâna 3–9 august", "luna august", … */
function periodWording(period: Period): string {
  return period.kind === 'custom'
    ? formatPeriodLabel('custom', new Date(), { from: period.from, to: period.to })
    : formatPeriodLabel(period.kind);
}

function MetricCardSkeleton() {
  return (
    <div
      className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface px-2.5 py-2"
      aria-hidden="true"
    >
      <div className="size-7 animate-pulse rounded-md bg-surface-raised" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="h-2.5 w-24 animate-pulse rounded bg-surface-raised" />
        <div className="h-4 w-9 animate-pulse rounded bg-surface-raised" />
      </div>
    </div>
  );
}

type MetricCard = {
  id: PanouView;
  label: string;
  value: string;
  themeKey: keyof typeof PANOU_METRIC_THEMES;
};

function buildCards(
  metrics: DashboardMetricsResponse | null,
  period: Period,
): MetricCard[] {
  const wording = periodWording(period);
  const dash = '—';

  return [
    {
      id: 'projects',
      label: 'Proiecte în curs',
      value: metrics ? String(metrics.inProgressProjectCount) : dash,
      themeKey: 'projects',
    },
    {
      id: 'hours',
      label: `Ore logate ${wording}`,
      value: metrics ? formatDurationMinutes(metrics.totalMinutes) : dash,
      themeKey: 'hours',
    },
    {
      id: 'people',
      label: `Au pontat ${wording}`,
      value: metrics ? String(metrics.distinctPersonCount) : dash,
      themeKey: 'people',
    },
    {
      id: 'onLeave',
      label: `În concediu ${wording}`,
      value: metrics ? String(metrics.onLeaveCount) : dash,
      themeKey: 'onLeave',
    },
    {
      id: 'notLogged',
      label: `Nu au pontat ${wording}`,
      value: metrics ? String(metrics.notLoggedPersonCount) : dash,
      themeKey: 'notLogged',
    },
  ];
}

export function PanouMetricCards() {
  const {
    activeView,
    setActiveView,
    period,
    periodReady,
    metrics,
    setMetrics,
    includeExternalCollaborators,
  } =
    usePanouDashboard();
  const [metricsLoading, setMetricsLoading] = useState(true);

  function selectView(view: PanouView) {
    // The period is deliberately kept: the cards themselves are period-scoped,
    // so switching views must not silently reset what they show.
    setActiveView(view);
  }

  const loadMetrics = useCallback(async () => {
    if (!periodReady) {
      return;
    }

    try {
      const response = await getDashboardMetrics(period, includeExternalCollaborators);
      setMetrics(response);
    } catch {
      setMetrics(null);
    } finally {
      setMetricsLoading(false);
    }
  }, [period, periodReady, setMetrics, includeExternalCollaborators]);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  useRegisterPanouRefetch('dashboard-metrics', loadMetrics);

  const cards = buildCards(metrics, period);

  if (metricsLoading) {
    return (
      <div
        className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        aria-busy="true"
        aria-label="Se încarcă metricile panoului"
      >
        {Array.from({ length: 5 }, (_, index) => (
          <MetricCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  function renderMetricCard({ id, label, value, themeKey }: MetricCard) {
    const theme = PANOU_METRIC_THEMES[themeKey];
    const isSelected = activeView === id;

    return (
      <button
        key={id}
        type="button"
        aria-pressed={isSelected}
        onClick={() => selectView(id)}
        className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-all ${
          isSelected
            ? 'border-transparent shadow-sm shadow-black/10'
            : 'border-border-subtle bg-surface hover:border-border hover:bg-surface-raised/40'
        }`}
        style={
          isSelected
            ? {
                backgroundColor: panouAccentTint(theme.accent, '12%'),
                boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${theme.accent} 35%, transparent)`,
              }
            : undefined
        }
      >
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-md"
          style={{
            backgroundColor: panouAccentTint(theme.accent, '22%'),
            color: theme.accent,
          }}
          aria-hidden="true"
        >
          <i className={`ti ${theme.icon} text-sm`} />
        </span>
        <span className="min-w-0">
          <span className="block text-[11px] leading-snug text-text-secondary">{label}</span>
          <span className="mt-0.5 block text-base font-semibold tabular-nums leading-tight text-text-primary">
            {value}
          </span>
        </span>
      </button>
    );
  }

  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => renderMetricCard(card))}
    </div>
  );
}

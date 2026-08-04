'use client';

import { getDashboardMetrics, type DashboardMetricsResponse } from '@fabxpert/shared';
import { useCallback, useEffect, useState } from 'react';
import { formatDurationMinutes } from '@/app/(app)/timesheets/timesheetFormat';
import { useRegisterPanouRefetch } from '../PanouRefreshContext';
import { usePanouDashboard, type PanouView } from './PanouDashboardContext';
import { PANOU_METRIC_THEMES, panouAccentTint } from './panouColors';

type MetricKey = keyof DashboardMetricsResponse;

const METRIC_CARDS: {
  id: PanouView;
  label: string;
  metricKey: MetricKey;
  themeKey: keyof typeof PANOU_METRIC_THEMES;
}[] = [
  {
    id: 'projects',
    label: 'Proiecte în curs',
    metricKey: 'inProgressProjectCount',
    themeKey: 'projects',
  },
  {
    id: 'hours',
    label: 'Ore logate azi',
    metricKey: 'todayTotalMinutes',
    themeKey: 'hours',
  },
  {
    id: 'people',
    label: 'Au pontat azi',
    metricKey: 'todayDistinctPersonCount',
    themeKey: 'people',
  },
];

function MetricCardSkeleton() {
  return (
    <div
      className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface px-2.5 py-2"
      aria-hidden="true"
    >
      <div className="size-7 animate-pulse rounded-md bg-surface-raised" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="h-2.5 w-20 animate-pulse rounded bg-surface-raised" />
        <div className="h-4 w-9 animate-pulse rounded bg-surface-raised" />
        <div className="h-2 w-14 animate-pulse rounded bg-surface-raised" />
      </div>
    </div>
  );
}

function formatMetricValue(key: MetricKey, metrics: DashboardMetricsResponse | null): string {
  if (!metrics) {
    return '—';
  }

  if (key === 'todayTotalMinutes') {
    return formatDurationMinutes(metrics.todayTotalMinutes);
  }

  return String(metrics[key]);
}

function metricSubtext(
  themeKey: keyof typeof PANOU_METRIC_THEMES,
  metrics: DashboardMetricsResponse | null,
): string {
  if (!metrics) {
    return PANOU_METRIC_THEMES[themeKey].label;
  }

  if (themeKey === 'people') {
    return metrics.todayDistinctPersonCount === 1 ? 'Utilizator' : 'Utilizatori';
  }

  if (themeKey === 'onLeave') {
    return metrics.todayOnLeaveCount === 1 ? 'Utilizator' : 'Utilizatori';
  }

  if (themeKey === 'notLogged') {
    return metrics.todayNotLoggedPersonCount === 1 ? 'Utilizator' : 'Utilizatori';
  }

  return PANOU_METRIC_THEMES[themeKey].label;
}

export function PanouMetricCards() {
  const { activeView, setActiveView, setPeriod, metrics, setMetrics } = usePanouDashboard();
  const [metricsLoading, setMetricsLoading] = useState(true);

  function selectView(view: PanouView) {
    setActiveView(view);
    if (
      view === 'hours' ||
      view === 'people' ||
      view === 'onLeave' ||
      view === 'notLogged'
    ) {
      setPeriod({ kind: 'today' });
    }
  }

  const loadMetrics = useCallback(async () => {
    try {
      const response = await getDashboardMetrics();
      setMetrics(response);
    } catch {
      setMetrics(null);
    } finally {
      setMetricsLoading(false);
    }
  }, [setMetrics]);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  useRegisterPanouRefetch('dashboard-metrics', loadMetrics);

  const onLeaveCount = metrics?.todayOnLeaveCount ?? 0;
  const notLoggedCount = metrics?.todayNotLoggedPersonCount ?? 0;

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

  function renderMetricCard(
    id: PanouView,
    label: string,
    metricKey: MetricKey,
    themeKey: keyof typeof PANOU_METRIC_THEMES,
    valueOverride?: string,
  ) {
    const theme = PANOU_METRIC_THEMES[themeKey];
    const isSelected = activeView === id;
    const value = valueOverride ?? formatMetricValue(metricKey, metrics);

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
          <span className="block truncate text-[11px] text-text-secondary">{label}</span>
          <span className="block text-base font-semibold tabular-nums leading-tight text-text-primary">
            {value}
          </span>
          <span className="block text-[10px] font-medium" style={{ color: theme.accent }}>
            {metricSubtext(themeKey, metrics)}
          </span>
        </span>
      </button>
    );
  }

  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {METRIC_CARDS.map((card) =>
        renderMetricCard(card.id, card.label, card.metricKey, card.themeKey),
      )}
      {renderMetricCard(
        'onLeave',
        'În concediu azi',
        'todayOnLeaveCount',
        'onLeave',
        String(onLeaveCount),
      )}
      {renderMetricCard(
        'notLogged',
        'Nu au pontat azi',
        'todayNotLoggedPersonCount',
        'notLogged',
        String(notLoggedCount),
      )}
    </div>
  );
}

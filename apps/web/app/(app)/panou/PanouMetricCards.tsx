'use client';

import { getDashboardMetrics, type DashboardMetricsResponse } from '@fabxpert/shared';
import { useCallback, useEffect, useState } from 'react';
import { formatDurationMinutes } from '@/app/(app)/timesheets/timesheetFormat';
import { useRegisterPanouRefetch } from '../PanouRefreshContext';
import { usePanouDashboard, type PanouView } from './PanouDashboardContext';

type MetricKey = keyof DashboardMetricsResponse;

const METRIC_CARDS: {
  id: PanouView;
  icon: string;
  label: string;
  metricKey: MetricKey;
}[] = [
  {
    id: 'projects',
    icon: 'ti-clipboard-list',
    label: 'Proiecte în curs',
    metricKey: 'inProgressProjectCount',
  },
  {
    id: 'hours',
    icon: 'ti-clock',
    label: 'Ore logate azi',
    metricKey: 'todayTotalMinutes',
  },
  {
    id: 'people',
    icon: 'ti-users',
    label: 'Au pontat azi',
    metricKey: 'todayDistinctPersonCount',
  },
];

function MetricCardSkeleton() {
  return (
    <div
      className="flex flex-col items-start rounded-md border border-border-subtle bg-surface px-3 py-2.5"
      aria-hidden="true"
    >
      <div className="h-3 w-28 max-w-full animate-pulse rounded bg-surface-raised" />
      <div className="mt-2 h-6 w-12 animate-pulse rounded bg-surface-raised" />
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

export function PanouMetricCards() {
  const { activeView, setActiveView, setPeriod, metrics, setMetrics } = usePanouDashboard();
  const [metricsLoading, setMetricsLoading] = useState(true);

  function selectView(view: PanouView) {
    setActiveView(view);
    if (view === 'hours' || view === 'people' || view === 'onLeave') {
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
  const cardClassName =
    'flex flex-col items-start rounded-md border border-border-subtle bg-surface px-3 py-2.5 text-left';

  if (metricsLoading) {
    return (
      <div
        className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
        aria-busy="true"
        aria-label="Se încarcă metricile panoului"
      >
        {Array.from({ length: 4 }, (_, index) => (
          <MetricCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`mt-4 grid gap-2 sm:grid-cols-2 ${
        onLeaveCount > 0 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
      }`}
    >
      {METRIC_CARDS.map((card) => {
        const isSelected = activeView === card.id;
        return (
          <button
            key={card.id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => selectView(card.id)}
            className={`${cardClassName} transition-colors ${
              isSelected
                ? 'border-accent/30 bg-accent/10 text-accent'
                : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
            }`}
          >
            <span className="inline-flex items-center gap-1.5 text-xs font-medium">
              <i className={`ti ${card.icon} text-sm`} aria-hidden="true" />
              {card.label}
            </span>
            <span className="mt-1 text-lg font-medium tabular-nums text-text-primary">
              {formatMetricValue(card.metricKey, metrics)}
            </span>
          </button>
        );
      })}
      {onLeaveCount > 0 && (
        <button
          type="button"
          aria-pressed={activeView === 'onLeave'}
          onClick={() => {
            setActiveView('onLeave');
            setPeriod({ kind: 'today' });
          }}
          className={`${cardClassName} transition-colors ${
            activeView === 'onLeave'
              ? 'border-accent/30 bg-accent/10 text-accent'
              : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
          }`}
        >
          <span className="inline-flex items-center gap-1.5 text-xs font-medium">
            <i className="ti ti-calendar-off text-sm" aria-hidden="true" />
            În concediu azi
          </span>
          <span className="mt-1 text-lg font-medium tabular-nums text-text-primary">
            {onLeaveCount}
          </span>
        </button>
      )}
    </div>
  );
}

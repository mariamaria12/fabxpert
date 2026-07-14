'use client';

import { getDashboardMetrics, type DashboardMetricsResponse } from '@fabxpert/shared';
import { useCallback, useEffect } from 'react';
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

  function selectView(view: PanouView) {
    setActiveView(view);
    if (view === 'hours' || view === 'people') {
      setPeriod({ kind: 'today' });
    }
  }

  const loadMetrics = useCallback(async () => {
    const response = await getDashboardMetrics();
    setMetrics(response);
  }, [setMetrics]);

  useEffect(() => {
    void loadMetrics().catch(() => {
      setMetrics(null);
    });
  }, [loadMetrics, setMetrics]);

  useRegisterPanouRefetch('dashboard-metrics', loadMetrics);

  const onLeaveCount = metrics?.todayOnLeaveCount ?? 0;
  const cardClassName =
    'flex flex-col items-start rounded-md border border-border-subtle bg-surface px-3 py-2.5 text-left';

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
        <div className={`${cardClassName} text-text-secondary`}>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium">
            <i className="ti ti-calendar-off text-sm" aria-hidden="true" />
            În concediu azi
          </span>
          <span className="mt-1 text-lg font-medium tabular-nums text-text-primary">
            {onLeaveCount}
          </span>
        </div>
      )}
    </div>
  );
}

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

  return (
    <div className="mt-6 grid gap-3 md:grid-cols-3">
      {METRIC_CARDS.map((card) => {
        const isSelected = activeView === card.id;
        return (
          <button
            key={card.id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => selectView(card.id)}
            className={`flex flex-col items-start rounded-md border px-4 py-4 text-left transition-colors ${
              isSelected
                ? 'border-accent/30 bg-accent/10 text-accent'
                : 'border-border-subtle bg-surface text-text-secondary hover:bg-surface-raised hover:text-text-primary'
            }`}
          >
            <span className="inline-flex items-center gap-2 text-sm font-medium">
              <i className={`ti ${card.icon} text-base`} aria-hidden="true" />
              {card.label}
            </span>
            <span className="mt-2 text-2xl font-medium tabular-nums text-text-primary">
              {formatMetricValue(card.metricKey, metrics)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

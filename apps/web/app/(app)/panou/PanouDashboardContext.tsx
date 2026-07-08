'use client';

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { DashboardMetricsResponse, Period } from '@fabxpert/shared';
import { isPeriodQueryReady } from '@fabxpert/shared';

export type PanouView = 'projects' | 'hours' | 'people';

export type PanouDashboardContextValue = {
  activeView: PanouView;
  setActiveView: (view: PanouView) => void;
  period: Period;
  setPeriod: (period: Period) => void;
  showPeriodSelector: boolean;
  periodReady: boolean;
  metrics: DashboardMetricsResponse | null;
  setMetrics: (metrics: DashboardMetricsResponse | null) => void;
};

const PanouDashboardContext = createContext<PanouDashboardContextValue | null>(null);

export function PanouDashboardProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useState<PanouView>('hours');
  const [period, setPeriod] = useState<Period>({ kind: 'today' });
  const [metrics, setMetrics] = useState<DashboardMetricsResponse | null>(null);

  const showPeriodSelector = activeView === 'hours' || activeView === 'people';
  const periodReady = isPeriodQueryReady(period);

  const value = useMemo(
    (): PanouDashboardContextValue => ({
      activeView,
      setActiveView,
      period,
      setPeriod,
      showPeriodSelector,
      periodReady,
      metrics,
      setMetrics,
    }),
    [activeView, period, showPeriodSelector, periodReady, metrics],
  );

  return (
    <PanouDashboardContext.Provider value={value}>{children}</PanouDashboardContext.Provider>
  );
}

export function usePanouDashboard() {
  const context = useContext(PanouDashboardContext);
  if (!context) {
    throw new Error('usePanouDashboard must be used within PanouDashboardProvider');
  }
  return context;
}

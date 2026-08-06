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

export type PanouView = 'projects' | 'hours' | 'people' | 'onLeave' | 'notLogged';

export type PanouDashboardContextValue = {
  activeView: PanouView;
  setActiveView: (view: PanouView) => void;
  period: Period;
  setPeriod: (period: Period) => void;
  periodReady: boolean;
  metrics: DashboardMetricsResponse | null;
  setMetrics: (metrics: DashboardMetricsResponse | null) => void;
  /**
   * "Gata de execuție" filter for the projects table. It lives here because the
   * control sits in the top toolbar while the table is further down the page.
   */
  readyForExecution: boolean | null;
  setReadyForExecution: (value: boolean | null) => void;
};

const PanouDashboardContext = createContext<PanouDashboardContextValue | null>(null);

export function PanouDashboardProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useState<PanouView>('projects');
  const [period, setPeriod] = useState<Period>({ kind: 'today' });
  const [metrics, setMetrics] = useState<DashboardMetricsResponse | null>(null);
  const [readyForExecution, setReadyForExecution] = useState<boolean | null>(null);

  // The metric cards are period-scoped, so the selector is always relevant.
  const periodReady = isPeriodQueryReady(period);

  const value = useMemo(
    (): PanouDashboardContextValue => ({
      activeView,
      setActiveView,
      period,
      setPeriod,
      periodReady,
      metrics,
      setMetrics,
      readyForExecution,
      setReadyForExecution,
    }),
    [activeView, period, periodReady, metrics, readyForExecution],
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

'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { DashboardMetricsResponse, Period } from '@fabxpert/shared';
import { isPeriodQueryReady } from '@fabxpert/shared';
import {
  clearPanouReturnPoint,
  readPanouReturnPoint,
  type PanouReturnPoint,
} from './panouReturnPoint';

export type PanouView = 'projects' | 'hours' | 'people' | 'onLeave' | 'notLogged';

export type PanouDashboardContextValue = {
  /** The project Back from the pontaje should reopen; null on an ordinary visit. */
  returnPoint: PanouReturnPoint | null;
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
  /**
   * External collaborators are hidden from "nu au pontat" by default. The
   * checkbox lives under that table but the metric card reads it too, so the
   * flag belongs here.
   */
  includeExternalCollaborators: boolean;
  setIncludeExternalCollaborators: (value: boolean) => void;
};

const INCLUDE_EXTERNAL_KEY = 'panou-not-logged-include-external';

function readStoredIncludeExternal(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.localStorage.getItem(INCLUDE_EXTERNAL_KEY) === '1';
}

const PanouDashboardContext = createContext<PanouDashboardContextValue | null>(null);

export function PanouDashboardProvider({ children }: { children: ReactNode }) {
  // Read while mounting, so the views underneath start on the right tab, page
  // and open project instead of correcting themselves after a first paint.
  const [returnPoint] = useState(readPanouReturnPoint);
  const [activeView, setActiveView] = useState<PanouView>(
    returnPoint?.source === 'hours' ? 'hours' : 'projects',
  );
  const [period, setPeriod] = useState<Period>(returnPoint?.period ?? { kind: 'today' });
  const [metrics, setMetrics] = useState<DashboardMetricsResponse | null>(null);
  const [readyForExecution, setReadyForExecution] = useState<boolean | null>(null);
  const [includeExternalCollaborators, setIncludeExternalCollaboratorsState] =
    useState(false);

  useEffect(() => {
    if (returnPoint) {
      clearPanouReturnPoint();
    }
  }, [returnPoint]);

  // Read after mount so server and first client render agree.
  useEffect(() => {
    setIncludeExternalCollaboratorsState(readStoredIncludeExternal());
  }, []);

  const setIncludeExternalCollaborators = useCallback((value: boolean) => {
    setIncludeExternalCollaboratorsState(value);
    window.localStorage.setItem(INCLUDE_EXTERNAL_KEY, value ? '1' : '0');
  }, []);

  // The metric cards are period-scoped, so the selector is always relevant.
  const periodReady = isPeriodQueryReady(period);

  const value = useMemo(
    (): PanouDashboardContextValue => ({
      returnPoint,
      activeView,
      setActiveView,
      period,
      setPeriod,
      periodReady,
      metrics,
      setMetrics,
      readyForExecution,
      setReadyForExecution,
      includeExternalCollaborators,
      setIncludeExternalCollaborators,
    }),
    [
      returnPoint,
      activeView,
      period,
      periodReady,
      metrics,
      readyForExecution,
      includeExternalCollaborators,
      setIncludeExternalCollaborators,
    ],
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

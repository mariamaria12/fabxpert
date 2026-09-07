'use client';

import { getOvertimeApprovalsPendingCount } from '@fabxpert/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type OvertimePendingCountContextValue = {
  /** People whose last complete month still waits for approval. */
  pendingCount: number;
  refreshPendingCount: () => Promise<void>;
};

const OvertimePendingCountContext = createContext<OvertimePendingCountContextValue | null>(null);

export function OvertimePendingCountProvider({ children }: { children: ReactNode }) {
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = useCallback(async () => {
    try {
      const response = await getOvertimeApprovalsPendingCount();
      setPendingCount(response.count);
    } catch {
      // Badge is best-effort — leave count at last known value on failure.
    }
  }, []);

  useEffect(() => {
    void refreshPendingCount();
  }, [refreshPendingCount]);

  const value = useMemo(
    () => ({ pendingCount, refreshPendingCount }),
    [pendingCount, refreshPendingCount],
  );

  return (
    <OvertimePendingCountContext.Provider value={value}>
      {children}
    </OvertimePendingCountContext.Provider>
  );
}

export function useOvertimePendingCount(): OvertimePendingCountContextValue {
  const context = useContext(OvertimePendingCountContext);
  if (!context) {
    throw new Error('useOvertimePendingCount must be used within OvertimePendingCountProvider');
  }
  return context;
}

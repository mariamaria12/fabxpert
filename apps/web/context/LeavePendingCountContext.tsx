'use client';

import { listLeaveRequests } from '@fabxpert/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type LeavePendingCountContextValue = {
  pendingCount: number;
  refreshPendingCount: () => Promise<void>;
};

const LeavePendingCountContext = createContext<LeavePendingCountContextValue | null>(null);

export function LeavePendingCountProvider({ children }: { children: ReactNode }) {
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = useCallback(async () => {
    try {
      const response = await listLeaveRequests({
        status: 'IN_ASTEPTARE',
        page: 1,
        pageSize: 1,
      });
      setPendingCount(response.meta.total);
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
    <LeavePendingCountContext.Provider value={value}>
      {children}
    </LeavePendingCountContext.Provider>
  );
}

export function useLeavePendingCount(): LeavePendingCountContextValue {
  const context = useContext(LeavePendingCountContext);
  if (!context) {
    throw new Error('useLeavePendingCount must be used within LeavePendingCountProvider');
  }
  return context;
}

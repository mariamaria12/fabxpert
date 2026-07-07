'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type RefetchFn = () => Promise<void>;

interface PanouRefreshContextValue {
  registerRefetch: (key: string, fn: RefetchFn) => () => void;
  refreshAll: () => Promise<void>;
  refreshing: boolean;
  lastUpdated: Date | null;
}

const PanouRefreshContext = createContext<PanouRefreshContextValue | null>(null);

export function PanouRefreshProvider({ children }: { children: ReactNode }) {
  const refetchersRef = useRef(new Map<string, RefetchFn>());
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const registerRefetch = useCallback((key: string, fn: RefetchFn) => {
    refetchersRef.current.set(key, fn);
    return () => {
      refetchersRef.current.delete(key);
    };
  }, []);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);

    const results = await Promise.allSettled(
      Array.from(refetchersRef.current.values(), (refetch) => refetch()),
    );

    if (results.some((result) => result.status === 'fulfilled')) {
      setLastUpdated(new Date());
    }

    setRefreshing(false);
  }, []);

  const value = useMemo(
    () => ({
      registerRefetch,
      refreshAll,
      refreshing,
      lastUpdated,
    }),
    [registerRefetch, refreshAll, refreshing, lastUpdated],
  );

  return (
    <PanouRefreshContext.Provider value={value}>{children}</PanouRefreshContext.Provider>
  );
}

export function usePanouRefresh() {
  const context = useContext(PanouRefreshContext);
  if (!context) {
    throw new Error('usePanouRefresh must be used within PanouRefreshProvider');
  }
  return context;
}

export function useRegisterPanouRefetch(key: string, refetch: RefetchFn) {
  const { registerRefetch } = usePanouRefresh();

  useEffect(() => {
    return registerRefetch(key, refetch);
  }, [key, registerRefetch, refetch]);
}

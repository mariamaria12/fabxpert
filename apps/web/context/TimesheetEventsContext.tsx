'use client';

import { subscribeToTimesheets, type TimesheetEvent } from '@fabxpert/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';

type TimesheetEventListener = (event: TimesheetEvent) => void;

interface TimesheetEventsContextValue {
  subscribe: (listener: TimesheetEventListener) => () => void;
}

const TimesheetEventsContext = createContext<TimesheetEventsContextValue | null>(null);

export function TimesheetEventsProvider({
  children,
  enabled,
}: {
  children: ReactNode;
  enabled: boolean;
}) {
  const listenersRef = useRef(new Set<TimesheetEventListener>());

  useEffect(() => {
    if (!enabled) {
      return;
    }

    return subscribeToTimesheets((event) => {
      for (const listener of listenersRef.current) {
        listener(event);
      }
    });
  }, [enabled]);

  const subscribe = useCallback((listener: TimesheetEventListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  return (
    <TimesheetEventsContext.Provider value={{ subscribe }}>
      {children}
    </TimesheetEventsContext.Provider>
  );
}

export function useTimesheetEvents(): TimesheetEventsContextValue {
  const context = useContext(TimesheetEventsContext);
  if (!context) {
    throw new Error('useTimesheetEvents must be used within TimesheetEventsProvider');
  }
  return context;
}

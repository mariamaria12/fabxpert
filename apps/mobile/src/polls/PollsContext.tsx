import { listActivePolls } from '@fabxpert/shared';
import type { PollDto } from '@fabxpert/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

interface PollsContextValue {
  /** Polls still running — the ones with no answer yet block the app on open. */
  polls: PollDto[];
  refresh: () => Promise<void>;
  /** Swaps in the poll as the API returned it after a vote. */
  replacePoll: (poll: PollDto) => void;
}

const PollsContext = createContext<PollsContextValue | null>(null);

/**
 * Holds the running polls above both the app-open screen and the home banner,
 * so answering in one place updates the other without a refetch.
 */
export function PollsProvider({ children }: { children: ReactNode }) {
  const [polls, setPolls] = useState<PollDto[]>([]);

  const refresh = useCallback(async () => {
    try {
      setPolls(await listActivePolls());
    } catch {
      /** Offline or logged out — never block the app on a poll. */
    }
  }, []);

  useEffect(() => {
    void refresh();

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refresh]);

  const replacePoll = useCallback((updated: PollDto) => {
    setPolls((current) => current.map((poll) => (poll.id === updated.id ? updated : poll)));
  }, []);

  return (
    <PollsContext.Provider value={{ polls, refresh, replacePoll }}>
      {children}
    </PollsContext.Provider>
  );
}

export function usePollsContext(): PollsContextValue {
  const context = useContext(PollsContext);
  if (!context) {
    throw new Error('usePollsContext must be used within PollsProvider');
  }
  return context;
}

/** A poll the user hasn't answered yet. */
export function isUnanswered(poll: PollDto): boolean {
  return poll.myOptionIds.length === 0;
}

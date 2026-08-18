import type { ReactNode } from 'react';
import { PollScreen } from './PollScreen';
import { isUnanswered, usePollsContext } from './PollsContext';
import { useNotificationsContext } from '../notifications/NotificationsContext';

/**
 * Puts unanswered polls in front of the app on open, one at a time. Once the
 * last one is answered the normal flow shows through — the home banner keeps
 * the poll reachable until it closes.
 */
export function PollGate({ children }: { children: ReactNode }) {
  const { polls, replacePoll } = usePollsContext();
  const { dismissForPoll } = useNotificationsContext();
  const poll = polls.find(isUnanswered);

  if (!poll) {
    return <>{children}</>;
  }

  return (
    <PollScreen
      key={poll.id}
      poll={poll}
      onAnswered={(answered) => {
        replacePoll(answered);
        // Same render as the screen closing, so the app behind it is already
        // showing the running-poll banner and nothing else.
        dismissForPoll(poll.id);
      }}
    />
  );
}

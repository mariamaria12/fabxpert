import type { PollDto } from '@fabxpert/shared';
import { useState } from 'react';
import { PollScreen } from './PollScreen';
import { isUnanswered, usePollsContext } from './PollsContext';
import { useNotificationsContext } from '../notifications/NotificationsContext';

function ChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 20V10M12 20V4M18 20v-6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Sits above the greeting for as long as a poll is running, so it can be opened
 * again after answering — to change nothing, just to see where the vote stands.
 */
export function PollBanner() {
  const { polls, refresh, replacePoll } = usePollsContext();
  const { refresh: refreshNotifications } = useNotificationsContext();
  const [openPollId, setOpenPollId] = useState<string | null>(null);

  if (polls.length === 0) {
    return null;
  }

  const openPoll = polls.find((poll) => poll.id === openPollId) ?? null;

  return (
    <>
      <div className="poll-banner-stack">
        {polls.map((poll: PollDto) => (
          <button
            key={poll.id}
            type="button"
            className="poll-banner"
            onClick={() => {
              setOpenPollId(poll.id);
              // The tally is the only place employees see the numbers — open it
              // on current counts, not on whatever was cached at app start.
              void refresh();
            }}
          >
            <span className="poll-banner-icon">
              <ChartIcon />
            </span>
            <span className="poll-banner-text">
              <span className="poll-banner-title">Aveți un sondaj în desfășurare</span>
              <span className="poll-banner-body">{poll.title}</span>
              <span className="poll-banner-hint">
                {isUnanswered(poll) ? 'Nu ai răspuns încă' : 'Vezi sau schimbă răspunsul'}
              </span>
            </span>
          </button>
        ))}
      </div>

      {openPoll ? (
        <PollScreen
          key={openPoll.id}
          poll={openPoll}
          dismissible
          onDone={(answered) => {
            replacePoll(answered);
            setOpenPollId(null);
            void refreshNotifications();
          }}
        />
      ) : null}
    </>
  );
}

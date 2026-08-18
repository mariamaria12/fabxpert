import { ApiError, formatPollAnswerCount, formatPollDeadline, votePoll } from '@fabxpert/shared';
import type { PollDto } from '@fabxpert/shared';
import { useState } from 'react';

interface PollScreenProps {
  poll: PollDto;
  /** Opened from the banner, so it can be left without answering. */
  dismissible?: boolean;
  /** A vote landed — the poll comes back with the fresh tally. */
  onAnswered: (poll: PollDto) => void;
  /** Left without answering. */
  onDismiss?: () => void;
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12l4 4L19 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The poll itself: the vote form, or the tally once the user has answered —
 * employees only ever see the counts, never who voted what.
 */
export function PollScreen({
  poll,
  dismissible = false,
  onAnswered,
  onDismiss,
}: PollScreenProps) {
  const hasAnswered = poll.myOptionIds.length > 0;
  const [selectedIds, setSelectedIds] = useState<string[]>(poll.myOptionIds);
  // An already-answered poll opens on the tally; sending an answer closes the
  // screen on the spot, so there is never a second button to press.
  const [showResults, setShowResults] = useState(hasAnswered);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleOption(optionId: string) {
    setError(null);
    setSelectedIds((current) => {
      if (poll.allowMultiple) {
        return current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId];
      }
      return current.includes(optionId) ? [] : [optionId];
    });
  }

  async function handleSubmit() {
    if (isSubmitting || selectedIds.length === 0) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      onAnswered(await votePoll(poll.id, { optionIds: selectedIds }));
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        setError('Sondajul nu mai acceptă răspunsuri.');
        return;
      }
      setError('Nu s-a putut trimite răspunsul. Încearcă din nou.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (showResults) {
    const totalVotes = poll.options.reduce((sum, option) => sum + option.voteCount, 0);

    return (
      <div className="poll-layer">
        <div className="poll-sheet">
          <p className="poll-eyebrow">Sondaj</p>
          <h1 className="poll-title">{poll.title}</h1>
          <p className="poll-meta">{formatPollAnswerCount(poll.answerCount)}</p>

          <ul className="poll-results">
            {poll.options.map((option) => {
              const share = totalVotes > 0 ? Math.round((option.voteCount / totalVotes) * 100) : 0;
              const isMine = poll.myOptionIds.includes(option.id);
              return (
                <li key={option.id} className="poll-result">
                  <div className="poll-result-head">
                    <span className={isMine ? 'poll-result-label is-mine' : 'poll-result-label'}>
                      {option.label}
                    </span>
                    <span className="poll-result-count">{option.voteCount}</span>
                  </div>
                  <div className="poll-result-bar">
                    <div className="poll-result-fill" style={{ width: `${share}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            className="poll-secondary"
            onClick={() => {
              setSelectedIds(poll.myOptionIds);
              setShowResults(false);
            }}
          >
            Schimbă răspunsul
          </button>

          <button type="button" className="poll-submit" onClick={() => onDismiss?.()}>
            Închide
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="poll-layer">
      <div className="poll-sheet">
        <div className="poll-sheet-head">
          <p className="poll-eyebrow">Sondaj</p>
          {dismissible ? (
            <button
              type="button"
              className="poll-close"
              aria-label="Închide sondajul"
              onClick={() => (hasAnswered ? setShowResults(true) : onDismiss?.())}
            >
              <CloseIcon />
            </button>
          ) : null}
        </div>

        <h1 className="poll-title">{poll.title}</h1>
        {poll.description ? <p className="poll-description">{poll.description}</p> : null}
        <p className="poll-meta">
          {poll.allowMultiple ? 'Poți alege mai multe opțiuni' : 'Alege o opțiune'}
          {poll.closesOn ? ` · până pe ${formatPollDeadline(poll.closesOn)}` : ''}
        </p>
        {hasAnswered ? (
          <p className="poll-meta">Ai răspuns deja — trimiterea înlocuiește răspunsul.</p>
        ) : null}

        <ul className="poll-options">
          {poll.options.map((option) => {
            const isSelected = selectedIds.includes(option.id);
            return (
              <li key={option.id}>
                <button
                  type="button"
                  className={isSelected ? 'poll-option is-selected' : 'poll-option'}
                  aria-pressed={isSelected}
                  disabled={isSubmitting}
                  onClick={() => toggleOption(option.id)}
                >
                  <span className="poll-option-label">{option.label}</span>
                  <span className="poll-option-mark">{isSelected ? <CheckIcon /> : null}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {error ? <p className="poll-error">{error}</p> : null}

        <button
          type="button"
          className="poll-submit"
          disabled={isSubmitting || selectedIds.length === 0}
          onClick={() => void handleSubmit()}
        >
          {isSubmitting
            ? 'Se trimite…'
            : hasAnswered
              ? 'Salvează răspunsul'
              : 'Trimite răspunsul'}
        </button>
      </div>
    </div>
  );
}

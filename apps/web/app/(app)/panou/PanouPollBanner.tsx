'use client';

import {
  formatPollAnswerCount,
  formatPollDeadline,
  listPolls,
  type PollDto,
} from '@fabxpert/shared';
import { useCallback, useEffect, useState } from 'react';
import { useRegisterPanouRefetch } from '../PanouRefreshContext';
import { PollDetailPanel } from '../admin/PollDetailPanel';
import { PollFormPanel } from '../admin/PollFormPanel';
import { replaceById } from '@/utils/replaceById';

/** Local calendar day as YYYY-MM-DD, the same shape `closesOn` uses. */
function todayKey(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Open and still taking answers — a poll past its closing day is not "running". */
function isRunning(poll: PollDto, today: string): boolean {
  return poll.status === 'OPEN' && (poll.closesOn === null || poll.closesOn >= today);
}

function answersLabel(poll: PollDto): string {
  if (poll.audienceCount > 0) {
    return `${poll.answerCount} din ${poll.audienceCount} au răspuns`;
  }
  return formatPollAnswerCount(poll.answerCount);
}

/**
 * One row per running poll, above the panou filters, so the admin sees where
 * the vote stands without leaving the dashboard. Opens the same results panel
 * as the admin page.
 */
export function PanouPollBanner() {
  const [polls, setPolls] = useState<PollDto[]>([]);
  const [openPollId, setOpenPollId] = useState<string | null>(null);
  const [editingPoll, setEditingPoll] = useState<PollDto | null>(null);

  const load = useCallback(async () => {
    try {
      setPolls(await listPolls());
    } catch {
      // The panou has its own error surfaces; a missing banner is not one.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useRegisterPanouRefetch('polls', load);

  const today = todayKey();
  const running = polls.filter((poll) => isRunning(poll, today));

  if (running.length === 0) {
    return null;
  }

  const openPoll = running.find((poll) => poll.id === openPollId) ?? null;

  function handleChanged(changed: PollDto) {
    setPolls((current) => replaceById(current, changed));
  }

  return (
    <>
      <div className="mt-3 flex flex-col gap-2">
        {running.map((poll) => (
          <button
            key={poll.id}
            type="button"
            onClick={() => setOpenPollId(poll.id)}
            className="flex w-full items-center gap-3 rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 text-left transition-colors hover:bg-accent/15"
          >
            <i className="ti ti-chart-bar shrink-0 text-lg text-accent" aria-hidden="true" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-accent">
                Sondaj în desfășurare
              </span>
              <span className="truncate text-sm font-medium text-text-primary">{poll.title}</span>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-secondary">
                <span className="tabular-nums">{answersLabel(poll)}</span>
                {poll.closesOn ? (
                  <span className="text-text-muted">· până pe {formatPollDeadline(poll.closesOn)}</span>
                ) : null}
              </span>
              <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-muted">
                {poll.options.map((option) => (
                  <span key={option.id} className="inline-flex items-center gap-1">
                    <span className="truncate">{option.label}</span>
                    <span className="font-medium tabular-nums text-text-secondary">
                      {option.voteCount}
                    </span>
                  </span>
                ))}
              </span>
            </span>
            <i className="ti ti-chevron-right shrink-0 text-base text-text-muted" aria-hidden="true" />
          </button>
        ))}
      </div>

      {openPoll ? (
        <PollDetailPanel
          poll={openPoll}
          onClose={() => setOpenPollId(null)}
          onChanged={handleChanged}
          onDeleted={(pollId) => {
            setPolls((current) => current.filter((poll) => poll.id !== pollId));
            setOpenPollId(null);
          }}
          onEdit={(poll) => {
            setOpenPollId(null);
            setEditingPoll(poll);
          }}
          onOutOfDate={() => void load()}
        />
      ) : null}

      <PollFormPanel
        open={editingPoll !== null}
        mode="edit"
        poll={editingPoll}
        onClose={() => setEditingPoll(null)}
        onSaved={(saved) => {
          handleChanged(saved);
          setEditingPoll(null);
        }}
      />
    </>
  );
}

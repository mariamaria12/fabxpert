'use client';

import {
  formatPollAnswerCount,
  formatPollDeadline,
  listPolls,
  publishPoll,
  reopenPoll,
  type PollDto,
} from '@fabxpert/shared';
import { useCallback, useEffect, useState } from 'react';
import { PollDetailPanel, PollStatusBadge } from './PollDetailPanel';
import { PollFormPanel } from './PollFormPanel';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { replaceById } from '@/utils/replaceById';

interface PollsSectionProps {
  active: boolean;
}

type FormState =
  | { open: false }
  | { open: true; mode: 'create'; poll: null }
  | { open: true; mode: 'edit'; poll: PollDto };

export function PollsSection({ active }: PollsSectionProps) {
  const { showToast } = useToast();
  const [polls, setPolls] = useState<PollDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ open: false });
  const [openPollId, setOpenPollId] = useState<string | null>(null);
  const [busyPollId, setBusyPollId] = useState<string | null>(null);

  const loadPolls = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setPolls(await listPolls());
    } catch (caught) {
      setError(apiErrorToastMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active) {
      void loadPolls();
    }
  }, [active, loadPolls]);

  function handleSaved(saved: PollDto) {
    setPolls((current) =>
      current.some((poll) => poll.id === saved.id)
        ? replaceById(current, saved)
        : [saved, ...current],
    );
  }

  async function handlePublish(poll: PollDto) {
    setBusyPollId(poll.id);
    try {
      const result = await publishPoll(poll.id);
      setPolls((current) => replaceById(current, result.poll));
      showToast(`Sondaj publicat · ${result.notifiedCount} persoane notificate`, 'success');
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setBusyPollId(null);
    }
  }

  async function handleReopen(poll: PollDto) {
    setBusyPollId(poll.id);
    try {
      const reopened = await reopenPoll(poll.id);
      setPolls((current) => replaceById(current, reopened));
      showToast('Sondaj redeschis', 'success');
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setBusyPollId(null);
    }
  }

  const openPoll = polls.find((poll) => poll.id === openPollId) ?? null;

  return (
    <section>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium text-text-primary">Sondaje</h2>
          <p className="mt-0.5 text-xs text-text-muted">
            Întrebări scurte pentru echipă. La publicare, toți angajații primesc o notificare.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setForm({ open: true, mode: 'create', poll: null })}
          className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-contrast transition-opacity hover:opacity-90 sm:px-4 sm:py-2 sm:text-sm"
        >
          Sondaj nou
        </button>
      </div>

      {error && (
        <div className="mt-4 flex items-center justify-between gap-4 rounded-md border border-border-subtle bg-[var(--color-toast-error-bg)] px-4 py-3">
          <p className="text-sm text-danger">{error}</p>
          <button
            type="button"
            onClick={() => void loadPolls()}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            Reîncearcă
          </button>
        </div>
      )}

      {loading && polls.length === 0 && (
        <p className="mt-6 text-sm text-text-muted">Se încarcă…</p>
      )}

      {!loading && !error && polls.length === 0 && (
        <p className="mt-6 text-sm text-text-muted">Niciun sondaj încă.</p>
      )}

      {polls.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {polls.map((poll) => (
            <li key={poll.id}>
              <div className="flex items-center gap-3 rounded-md border border-border-subtle px-4 py-3 transition-colors hover:border-border">
                <button
                  type="button"
                  onClick={() => setOpenPollId(poll.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-2">
                    <PollStatusBadge status={poll.status} />
                    <span className="truncate text-sm text-text-primary">{poll.title}</span>
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    {poll.options.length} opțiuni
                    {poll.status !== 'DRAFT' &&
                      ` · ${formatPollAnswerCount(poll.answerCount)} din ${poll.audienceCount}`}
                    {poll.closesOn && ` · până pe ${formatPollDeadline(poll.closesOn)}`}
                  </p>
                </button>

                {poll.status === 'DRAFT' && (
                  <button
                    type="button"
                    disabled={busyPollId === poll.id}
                    onClick={() => void handlePublish(poll)}
                    className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyPollId === poll.id ? 'Se publică…' : 'Publicare'}
                  </button>
                )}

                {poll.status === 'CLOSED' && (
                  <button
                    type="button"
                    disabled={busyPollId === poll.id}
                    onClick={() => void handleReopen(poll)}
                    className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busyPollId === poll.id ? 'Se redeschide…' : 'Redeschide'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {form.open && (
        <PollFormPanel
          open
          mode={form.mode}
          poll={form.poll}
          onClose={() => setForm({ open: false })}
          onSaved={handleSaved}
        />
      )}

      {openPoll && (
        <PollDetailPanel
          poll={openPoll}
          onClose={() => setOpenPollId(null)}
          onChanged={handleSaved}
          onDeleted={(pollId) => {
            setPolls((current) => current.filter((poll) => poll.id !== pollId));
            setOpenPollId(null);
          }}
          onEdit={(poll) => {
            setOpenPollId(null);
            setForm({ open: true, mode: 'edit', poll });
          }}
        />
      )}
    </section>
  );
}

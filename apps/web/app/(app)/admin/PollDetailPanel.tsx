'use client';

import {
  closePoll,
  deletePoll,
  formatPollAnswerCount,
  formatPollDeadline,
  getPollStatusLabel,
  publishPoll,
  reopenPoll,
  type PollDto,
} from '@fabxpert/shared';
import { useState } from 'react';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';

export interface PollDetailPanelProps {
  poll: PollDto;
  onClose: () => void;
  onChanged: (poll: PollDto) => void;
  onDeleted: (pollId: string) => void;
  onEdit: (poll: PollDto) => void;
}

/** Results of one poll, with who answered what — admins see names, not just counts. */
export function PollDetailPanel({
  poll,
  onClose,
  onChanged,
  onDeleted,
  onEdit,
}: PollDetailPanelProps) {
  const { showToast } = useToast();
  const [busyAction, setBusyAction] = useState<'publish' | 'close' | 'reopen' | 'delete' | null>(
    null,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isBusy = busyAction !== null;
  const totalVotes = poll.options.reduce((sum, option) => sum + option.voteCount, 0);

  async function handlePublish() {
    setBusyAction('publish');
    try {
      const result = await publishPoll(poll.id);
      onChanged(result.poll);
      showToast(`Sondaj publicat · ${result.notifiedCount} persoane notificate`, 'success');
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleClose() {
    setBusyAction('close');
    try {
      onChanged(await closePoll(poll.id));
      showToast('Sondaj închis', 'success');
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleReopen() {
    setBusyAction('reopen');
    try {
      onChanged(await reopenPoll(poll.id));
      showToast('Sondaj redeschis', 'success');
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDelete() {
    setBusyAction('delete');
    try {
      await deletePoll(poll.id);
      showToast('Sondaj șters', 'success');
      onDeleted(poll.id);
      onClose();
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setBusyAction(null);
    }
  }

  const footer = confirmDelete ? (
    <div>
      <p className="text-sm text-text-secondary">Sigur ștergi acest sondaj?</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void handleDelete()}
          className="flex-1 rounded-md bg-[var(--color-timer-stop)] px-4 py-2.5 text-sm font-medium text-[var(--color-timer-stop-text)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busyAction === 'delete' ? 'Se șterge…' : 'Șterge'}
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => setConfirmDelete(false)}
          className="flex-1 rounded-md border border-border px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Anulează
        </button>
      </div>
    </div>
  ) : (
    <div className="flex gap-2">
      {poll.status === 'DRAFT' && (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void handlePublish()}
          className="flex-1 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busyAction === 'publish' ? 'Se publică…' : 'Publicare'}
        </button>
      )}

      {poll.status === 'OPEN' && (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void handleClose()}
          className="flex-1 rounded-md border border-border px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busyAction === 'close' ? 'Se închide…' : 'Închide sondajul'}
        </button>
      )}

      {poll.status === 'CLOSED' && (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void handleReopen()}
          className="flex-1 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busyAction === 'reopen' ? 'Se redeschide…' : 'Redeschide'}
        </button>
      )}

      {poll.status === 'DRAFT' && (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => onEdit(poll)}
          className="rounded-md border border-border px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Editează
        </button>
      )}

      <button
        type="button"
        disabled={isBusy}
        onClick={() => setConfirmDelete(true)}
        aria-label="Șterge sondajul"
        className="rounded-md border border-border px-3 py-2.5 text-text-muted transition-colors hover:bg-surface-raised hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
      >
        <i className="ti ti-trash text-base" aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <SlideOverPanel
      open
      title="Sondaj"
      onClose={onClose}
      disableClose={isBusy}
      footer={footer}
      widthClassName="max-w-lg"
    >
      <div className="flex flex-col gap-5">
        <div>
          <div className="flex items-center gap-2">
            <PollStatusBadge status={poll.status} />
            {poll.closesOn && (
              <span className="text-xs text-text-muted">
                până pe {formatPollDeadline(poll.closesOn)}
              </span>
            )}
          </div>
          <h3 className="mt-2 text-base font-medium text-text-primary">{poll.title}</h3>
          {poll.description && (
            <p className="mt-1 text-sm text-text-secondary">{poll.description}</p>
          )}
          <p className="mt-2 text-xs text-text-muted">
            {poll.status === 'DRAFT'
              ? 'Nepublicat — echipa nu îl vede încă.'
              : `${formatPollAnswerCount(poll.answerCount)} din ${poll.audienceCount} angajați`}
          </p>
          {poll.status === 'CLOSED' && (
            <p className="mt-1 text-xs text-text-muted">
              Redeschiderea nu trimite o notificare nouă — sondajul reapare în aplicație.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {poll.options.map((option) => {
            const share = totalVotes > 0 ? Math.round((option.voteCount / totalVotes) * 100) : 0;
            return (
              <div key={option.id} className="rounded-md border border-border-subtle p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-text-primary">{option.label}</span>
                  <span className="shrink-0 text-xs text-text-muted">
                    {option.voteCount} · {share}%
                  </span>
                </div>

                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-raised"
                  role="presentation"
                >
                  <div className="h-full rounded-full bg-accent" style={{ width: `${share}%` }} />
                </div>

                {option.voters && option.voters.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {option.voters.map((voter) => (
                      <li
                        key={voter.userId}
                        className="rounded-full bg-surface-raised px-2 py-0.5 text-xs text-text-secondary"
                      >
                        {voter.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        {poll.createdByName && (
          <p className="text-xs text-text-muted">Creat de {poll.createdByName}</p>
        )}
      </div>
    </SlideOverPanel>
  );
}

export function PollStatusBadge({ status }: { status: PollDto['status'] }) {
  const className =
    status === 'OPEN'
      ? 'bg-accent/10 text-accent'
      : status === 'CLOSED'
        ? 'bg-surface-raised text-text-muted'
        : 'bg-surface-raised text-text-secondary';

  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}>
      {getPollStatusLabel(status)}
    </span>
  );
}

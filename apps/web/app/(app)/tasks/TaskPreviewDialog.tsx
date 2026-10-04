'use client';

import {
  addTaskComment,
  ApiError,
  formatPersonName,
  getTask,
  getTaskPriorityLabel,
  TASK_COMMENT_MAX_LENGTH,
  type TaskDetailDto,
  type TaskDto,
} from '@fabxpert/shared';
import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useBusinessAutofillProps } from '@/components/inputAutofill';
import { useAuthUser } from '@/context/AuthUserContext';
import { useReloadOnTasksChanged } from '@/context/TasksContext';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { taskHref } from '@/utils/taskNavigation';
import {
  formatTaskTimestamp,
  TASK_PRIORITY_TONE,
  TaskDueDate,
  taskProjectLabel,
} from './taskDisplay';

interface TaskPreviewDialogProps {
  /** The task as the list has it — shown at once, while the rest loads. */
  task: TaskDto;
  onClose: () => void;
}

/**
 * A task read like a conversation: what was asked, then the comments, with a
 * field to answer. Nothing is edited here — "Editează" opens the task page.
 */
export function TaskPreviewDialog({ task: summary, onClose }: TaskPreviewDialogProps) {
  const { showToast } = useToast();
  const authUser = useAuthUser();
  const businessAutofill = useBusinessAutofillProps();
  const titleId = useId();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const lastCommentRef = useRef<HTMLLIElement>(null);
  const [detail, setDetail] = useState<TaskDetailDto | null>(null);
  const [missing, setMissing] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      setDetail(await getTask(summary.id));
    } catch (caught) {
      // Anything else leaves the summary up; the task page reports real errors.
      if (caught instanceof ApiError && caught.status === 404) {
        setMissing(true);
      }
    }
  }, [summary.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useReloadOnTasksChanged(() => void load());

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    composerRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const task = detail ?? summary;
  const comments = detail?.comments ?? [];
  const checklist = detail?.checklist ?? [];
  const tone = TASK_PRIORITY_TONE[task.priority];

  // The newest comment is the last one; keep it in view as they come in.
  useEffect(() => {
    lastCommentRef.current?.scrollIntoView({ block: 'nearest' });
  }, [comments.length]);

  async function handleAddComment(event: FormEvent) {
    event.preventDefault();
    const body = newComment.trim();
    if (!body || sending) {
      return;
    }

    setSending(true);
    try {
      setDetail(await addTaskComment(summary.id, { body }));
      setNewComment('');
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setSending(false);
    }
  }

  const dialog = (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-scrim p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-surface shadow-modal">
        <div className="flex items-start gap-3 border-b border-border-subtle px-5 py-4">
          <span
            className={`mt-2 size-2.5 shrink-0 rounded-full ${tone.solid}`}
            title={`Prioritate: ${getTaskPriorityLabel(task.priority).toLowerCase()}`}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="break-words text-lg font-medium text-text-primary">
              {task.title}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
              <span className="min-w-0 truncate">{taskProjectLabel(task.project)}</span>
              {task.dueDate ? <TaskDueDate task={task} /> : null}
              <span className={tone.text}>{getTaskPriorityLabel(task.priority)}</span>
            </p>
          </div>
          <Link
            href={taskHref({ taskId: task.id })}
            aria-label="Editează task-ul"
            title="Editează"
            className="flex size-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-border text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary sm:w-auto sm:px-2.5"
          >
            <i className="ti ti-pencil text-base" aria-hidden="true" />
            <span className="hidden sm:inline">Editează</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Închide"
            title="Închide"
            className="-mr-1 flex size-8 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            <i className="ti ti-x text-lg" aria-hidden="true" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          {missing ? (
            <p className="text-sm text-text-muted">Task-ul nu mai există.</p>
          ) : (
            <>
              <div>
                <p className="text-xs text-text-muted">
                  De la{' '}
                  <span className="font-medium text-text-secondary">
                    {formatPersonName(task.createdBy)}
                  </span>{' '}
                  către{' '}
                  <span className="font-medium text-text-secondary">
                    {task.assignee.id === authUser?.id ? 'mine' : formatPersonName(task.assignee)}
                  </span>
                  {' · '}
                  {formatTaskTimestamp(task.createdAt)}
                </p>
                {task.description ? (
                  <p className="mt-2 whitespace-pre-wrap break-words rounded-2xl rounded-tl-md bg-surface-raised px-4 py-3 text-sm text-text-primary">
                    {task.description}
                  </p>
                ) : null}
              </div>

              {checklist.length > 0 ? (
                <ul className="flex flex-col gap-1.5 text-sm">
                  {checklist.map((item) => (
                    <li key={item.id} className="flex items-start gap-2">
                      <i
                        className={`ti mt-0.5 text-base ${
                          item.isDone
                            ? 'ti-circle-check text-success'
                            : 'ti-circle text-text-disabled'
                        }`}
                        aria-hidden="true"
                      />
                      <span
                        className={
                          item.isDone ? 'text-text-muted line-through' : 'text-text-primary'
                        }
                      >
                        {item.text}
                        {item.isDone ? <span className="sr-only"> (făcut)</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {comments.length > 0 ? (
                <ul aria-label="Comentarii" className="flex flex-col gap-2.5">
                  {comments.map((comment, index) => {
                    const mine = comment.author.id === authUser?.id;
                    return (
                      <li
                        key={comment.id}
                        ref={index === comments.length - 1 ? lastCommentRef : undefined}
                        className={`flex max-w-[85%] flex-col ${mine ? 'items-end self-end' : 'items-start self-start'}`}
                      >
                        <span className="px-1 text-[11px] text-text-muted">
                          {mine ? 'Eu' : formatPersonName(comment.author)} ·{' '}
                          {formatTaskTimestamp(comment.createdAt)}
                        </span>
                        <p
                          className={`mt-0.5 whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm text-text-primary ${
                            mine
                              ? 'rounded-br-md bg-[var(--color-accent-tint-strong)]'
                              : 'rounded-bl-md bg-surface-raised'
                          }`}
                        >
                          {comment.body}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              ) : detail ? (
                <p className="text-center text-xs text-text-muted">Niciun comentariu încă.</p>
              ) : null}
            </>
          )}
        </div>

        {missing ? null : (
          <form
            onSubmit={handleAddComment}
            className="flex items-end gap-2 border-t border-border-subtle px-5 py-3"
          >
            <textarea
              ref={composerRef}
              rows={1}
              value={newComment}
              maxLength={TASK_COMMENT_MAX_LENGTH}
              placeholder="Scrie un comentariu…"
              aria-label="Comentariu nou"
              onChange={(event) => setNewComment(event.target.value)}
              onKeyDown={(event) => {
                // Enter sends, Shift+Enter breaks the line.
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              className="max-h-32 min-h-[40px] flex-1 resize-none rounded-2xl border border-border bg-surface-raised px-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              {...businessAutofill}
            />
            <button
              type="submit"
              disabled={sending || !newComment.trim()}
              aria-label="Trimite comentariul"
              title="Trimite"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-contrast transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <i className="ti ti-send text-base" aria-hidden="true" />
            </button>
          </form>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(dialog, document.body) : null;
}

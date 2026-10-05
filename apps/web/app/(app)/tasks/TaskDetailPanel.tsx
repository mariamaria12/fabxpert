'use client';

import {
  addTaskChecklistItem,
  addTaskComment,
  ApiError,
  deleteTask,
  deleteTaskChecklistItem,
  formatPersonName,
  formatTaskDueDate,
  getTask,
  getTaskPriorityLabel,
  getTaskStatusLabel,
  isTaskOverdue,
  TASK_CHECKLIST_MAX_ITEMS,
  TASK_CHECKLIST_TEXT_MAX_LENGTH,
  TASK_COMMENT_MAX_LENGTH,
  TASK_DESCRIPTION_MAX_LENGTH,
  TASK_STATUS_VALUES,
  TASK_TITLE_MAX_LENGTH,
  updateTask,
  updateTaskChecklistItem,
  type TaskDetailDto,
  type TaskEventDto,
  type TaskPriority,
  type TaskStatus,
  type UpdateTaskInput,
} from '@fabxpert/shared';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { DateField } from '@/components/DateField';
import { FORM_FIELD_CLASS, FORM_LABEL_CLASS } from '@/components/formFieldStyles';
import { useBusinessAutofillProps } from '@/components/inputAutofill';
import { SearchableSelect } from '@/components/SearchableSelect';
import { SelectField } from '@/components/SelectField';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import { useToast } from '@/context/ToastContext';
import { useReloadOnTasksChanged } from '@/context/TasksContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import {
  formatTaskTimestamp,
  TaskAssignee,
  TaskPriorityPicker,
  taskProjectLabel,
} from './taskDisplay';
import type { TaskLookups } from './useTaskLookups';

interface TaskDetailPanelProps {
  taskId: string;
  lookups: TaskLookups;
  onClose: () => void;
  /** Called after every change made here, so the list behind can reload. */
  onChanged: () => void;
}

const STATUS_OPTIONS = TASK_STATUS_VALUES.map((status) => ({
  id: status,
  label: getTaskStatusLabel(status),
}));

const SECTION_TITLE_CLASS = 'text-sm font-medium text-text-primary';

/** What happened, after the actor's name: "a schimbat statusul → În lucru". */
function describeEvent(event: TaskEventDto): string {
  switch (event.type) {
    case 'CREATED':
      return 'a creat task-ul';
    case 'STATUS_CHANGED':
      return event.toValue === 'DONE'
        ? 'a finalizat task-ul'
        : `a schimbat statusul → ${getTaskStatusLabel(event.toValue as TaskStatus)}`;
    case 'ASSIGNEE_CHANGED':
      return `a schimbat responsabilul → ${event.toValue ?? '—'}`;
    case 'DUE_DATE_CHANGED':
      return event.toValue
        ? `a modificat termenul → ${formatTaskDueDate(event.toValue)}`
        : 'a șters termenul';
    case 'PRIORITY_CHANGED':
      return `a schimbat prioritatea → ${getTaskPriorityLabel(event.toValue as TaskPriority)}`;
    default:
      return 'a modificat task-ul';
  }
}

/** One task with everything on it: properties, checklist, comments, history. */
export function TaskDetailPanel({ taskId, lookups, onClose, onChanged }: TaskDetailPanelProps) {
  const { showToast } = useToast();
  const businessAutofill = useBusinessAutofillProps();
  const [task, setTask] = useState<TaskDetailDto | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [dueDateDraft, setDueDateDraft] = useState('');
  const [newItem, setNewItem] = useState('');
  const [newComment, setNewComment] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  // A draft being typed is never overwritten by a reload.
  const editingRef = useRef<'title' | 'description' | 'dueDate' | null>(null);
  // Counts the requests sent; an answer is shown only if nothing was asked after it.
  const requestRef = useRef(0);

  const adopt = useCallback((next: TaskDetailDto) => {
    setTask(next);
    if (editingRef.current !== 'title') {
      setTitleDraft(next.title);
    }
    if (editingRef.current !== 'description') {
      setDescriptionDraft(next.description ?? '');
    }
    if (editingRef.current !== 'dueDate') {
      setDueDateDraft(next.dueDate ?? '');
    }
  }, []);

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    try {
      const loaded = await getTask(taskId);
      if (requestId === requestRef.current) {
        adopt(loaded);
        setMissing(false);
      }
    } catch (caught) {
      if (requestId === requestRef.current && caught instanceof ApiError && caught.status === 404) {
        setMissing(true);
      }
    }
  }, [adopt, taskId]);

  useEffect(() => {
    setTask(null);
    setMissing(false);
    setConfirmDelete(false);
    setNewItem('');
    setNewComment('');
    editingRef.current = null;
    void load();
  }, [load]);

  useReloadOnTasksChanged(() => void load());

  /**
   * Runs a change that answers with the task as it now stands. `quiet` leaves
   * the drawer enabled: a save that starts when a field loses focus must not
   * disable the very control whose click took the focus away.
   */
  async function apply(change: () => Promise<TaskDetailDto>, quiet = false): Promise<boolean> {
    if (!quiet) {
      setBusy(true);
    }
    const requestId = ++requestRef.current;
    try {
      const changed = await change();
      // A later request answers with newer data — and may be for another task.
      if (requestId === requestRef.current) {
        adopt(changed);
      }
      onChanged();
      return true;
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
      return false;
    } finally {
      if (!quiet) {
        setBusy(false);
      }
    }
  }

  function patch(input: UpdateTaskInput, quiet = false) {
    return apply(() => updateTask(taskId, input), quiet);
  }

  function commitTitle() {
    editingRef.current = null;
    const trimmed = titleDraft.trim();
    if (!task || trimmed === task.title) {
      return;
    }
    if (!trimmed) {
      setTitleDraft(task.title);
      return;
    }
    void patch({ title: trimmed }, true);
  }

  function commitDescription() {
    editingRef.current = null;
    if (!task || descriptionDraft.trim() === (task.description ?? '')) {
      return;
    }
    void patch({ description: descriptionDraft.trim() || null }, true);
  }

  /**
   * A full date is saved as soon as it is picked or typed. An emptied field is
   * only saved once the focus leaves it — emptying is also how a new date
   * starts being typed.
   */
  function handleDueDateChange(next: string) {
    setDueDateDraft(next);
    if (task && next && next !== task.dueDate) {
      void patch({ dueDate: next }, true);
    }
  }

  function commitDueDate() {
    editingRef.current = null;
    if (!task) {
      return;
    }
    if (dueDateDraft === '' && task.dueDate !== null) {
      void patch({ dueDate: null }, true);
    }
  }

  async function handleAddItem(event: FormEvent) {
    event.preventDefault();
    const text = newItem.trim();
    if (!text || busy) {
      return;
    }
    if (await apply(() => addTaskChecklistItem(taskId, { text }))) {
      setNewItem('');
    }
  }

  async function handleAddComment(event: FormEvent) {
    event.preventDefault();
    const body = newComment.trim();
    if (!body || busy) {
      return;
    }
    if (await apply(() => addTaskComment(taskId, { body }))) {
      setNewComment('');
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await deleteTask(taskId);
      showToast('Task-ul a fost șters.', 'success');
      onChanged();
      onClose();
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
      setBusy(false);
    }
  }

  if (missing) {
    return (
      <SlideOverPanel open title="Task" onClose={onClose} widthClassName="max-w-lg">
        <p className="py-10 text-center text-sm text-text-muted">
          Task-ul nu mai există. A fost șters între timp.
        </p>
      </SlideOverPanel>
    );
  }

  if (!task) {
    return (
      <SlideOverPanel open title="Task" onClose={onClose} widthClassName="max-w-lg">
        <p className="py-10 text-center text-sm text-text-muted">Se încarcă…</p>
      </SlideOverPanel>
    );
  }

  const isDone = task.status === 'DONE';
  const overdue = isTaskOverdue(task);
  const checklistFull = task.checklist.length >= TASK_CHECKLIST_MAX_ITEMS;
  const checklistPercent =
    task.checklistTotalCount > 0
      ? Math.round((task.checklistDoneCount / task.checklistTotalCount) * 100)
      : 0;

  const footer = confirmDelete ? (
    <div className="flex items-center gap-3">
      <p className="min-w-0 flex-1 text-sm text-text-secondary">Ștergi task-ul definitiv?</p>
      <button
        type="button"
        onClick={() => setConfirmDelete(false)}
        disabled={busy}
        className="rounded-md border border-border px-3 py-2 text-sm text-text-secondary hover:bg-surface-raised hover:text-text-primary disabled:opacity-50"
      >
        Renunță
      </button>
      <button
        type="button"
        onClick={() => void handleDelete()}
        disabled={busy}
        className="rounded-md bg-danger-solid px-3 py-2 text-sm font-medium text-text-on-primary disabled:opacity-60"
      >
        Șterge
      </button>
    </div>
  ) : (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={() => setConfirmDelete(true)}
        disabled={busy}
        className="inline-flex items-center gap-2 text-sm text-text-muted transition-colors hover:text-danger disabled:opacity-50"
      >
        <i className="ti ti-trash text-base" aria-hidden="true" />
        Șterge task-ul
      </button>
      <button
        type="button"
        onClick={() => void patch({ status: isDone ? 'TODO' : 'DONE' })}
        disabled={busy}
        className={
          isDone
            ? 'inline-flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm text-text-secondary hover:bg-surface-raised hover:text-text-primary disabled:opacity-50'
            : 'inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-contrast disabled:opacity-60'
        }
      >
        <i className={`ti ${isDone ? 'ti-rotate' : 'ti-check'} text-base`} aria-hidden="true" />
        {isDone ? 'Redeschide' : 'Marchează finalizat'}
      </button>
    </div>
  );

  return (
    <SlideOverPanel open title="Task" onClose={onClose} widthClassName="max-w-lg" footer={footer}>
      <div className="flex flex-col gap-6">
        <div>
          <label htmlFor="taskDetailTitle" className="sr-only">
            Titlu
          </label>
          <input
            id="taskDetailTitle"
            value={titleDraft}
            maxLength={TASK_TITLE_MAX_LENGTH}
            disabled={busy}
            onFocus={() => {
              editingRef.current = 'title';
            }}
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={commitTitle}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.currentTarget.blur();
              }
            }}
            className={`-mx-2 w-[calc(100%+1rem)] rounded-md border border-transparent bg-transparent px-2 py-1 text-lg font-medium text-text-primary hover:border-border focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent ${
              isDone ? 'line-through decoration-text-muted' : ''
            }`}
            {...businessAutofill}
          />
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-secondary">
            <i className="ti ti-clipboard-list text-base text-text-muted" aria-hidden="true" />
            <span className="min-w-0 truncate">{taskProjectLabel(task.project)}</span>
            {overdue ? (
              <span className="inline-flex items-center rounded border border-danger-border bg-danger-bg px-2 py-0.5 text-xs font-medium text-danger-text">
                Întârziat
              </span>
            ) : null}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-4">
          <SelectField
            id="taskDetailStatus"
            label="Status"
            value={task.status}
            options={STATUS_OPTIONS}
            disabled={busy}
            onChange={(next) => {
              if (next !== task.status) {
                void patch({ status: next as TaskStatus });
              }
            }}
          />
          <SearchableSelect
            id="taskDetailAssignee"
            label="Responsabil"
            value={task.assignee.id}
            options={lookups.assigneeOptions}
            selectedLabel={formatPersonName(task.assignee)}
            clearable={false}
            disabled={busy}
            onChange={(next) => {
              if (next && next !== task.assignee.id) {
                void patch({ assigneeUserId: next });
              }
            }}
          />
          <div
            onFocus={() => {
              editingRef.current = 'dueDate';
            }}
            onBlur={(event) => {
              // Moving between the field and its calendar button is not leaving.
              if (!event.currentTarget.contains(event.relatedTarget)) {
                commitDueDate();
              }
            }}
          >
            <DateField
              id="taskDetailDueDate"
              label="Termen"
              value={dueDateDraft}
              disabled={busy}
              onChange={handleDueDateChange}
            />
          </div>
          <div className="col-span-2">
            <span className={FORM_LABEL_CLASS}>Prioritate</span>
            <TaskPriorityPicker
              value={task.priority}
              disabled={busy}
              onChange={(next) => {
                if (next !== task.priority) {
                  void patch({ priority: next });
                }
              }}
            />
          </div>
        </div>

        <div>
          <label htmlFor="taskDetailDescription" className={FORM_LABEL_CLASS}>
            Descriere
          </label>
          <textarea
            id="taskDetailDescription"
            rows={4}
            maxLength={TASK_DESCRIPTION_MAX_LENGTH}
            value={descriptionDraft}
            placeholder="Adaugă detalii…"
            disabled={busy}
            onFocus={() => {
              editingRef.current = 'description';
            }}
            onChange={(event) => setDescriptionDraft(event.target.value)}
            onBlur={commitDescription}
            className={`${FORM_FIELD_CLASS} resize-y`}
            {...businessAutofill}
          />
        </div>

        <section aria-labelledby="taskChecklistTitle">
          <div className="flex items-center justify-between gap-3">
            <h3 id="taskChecklistTitle" className={SECTION_TITLE_CLASS}>
              Checklist
            </h3>
            {task.checklistTotalCount > 0 ? (
              <span className="text-xs tabular-nums text-text-muted">
                {task.checklistDoneCount} / {task.checklistTotalCount}
              </span>
            ) : null}
          </div>
          {task.checklistTotalCount > 0 ? (
            <div
              className="mt-2 h-1 overflow-hidden rounded-full bg-surface-sunken"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={task.checklistTotalCount}
              aria-valuenow={task.checklistDoneCount}
              aria-label="Progres checklist"
            >
              <div
                className={`h-full rounded-full transition-[width] ${
                  checklistPercent === 100 ? 'bg-success' : 'bg-accent'
                }`}
                style={{ width: `${checklistPercent}%` }}
              />
            </div>
          ) : null}

          <ul className="mt-2 flex flex-col">
            {task.checklist.map((item) => (
              <li key={item.id} className="group flex items-center gap-2 py-1">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={item.isDone}
                    disabled={busy}
                    onChange={(event) =>
                      void apply(() =>
                        updateTaskChecklistItem(taskId, item.id, {
                          isDone: event.target.checked,
                        }),
                      )
                    }
                    className="size-4 shrink-0 accent-[var(--color-primary)]"
                  />
                  <span
                    className={`min-w-0 break-words ${
                      item.isDone ? 'text-text-muted line-through' : 'text-text-primary'
                    }`}
                  >
                    {item.text}
                  </span>
                </label>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void apply(() => deleteTaskChecklistItem(taskId, item.id))}
                  aria-label={`Șterge „${item.text}”`}
                  title="Șterge"
                  className="flex size-6 shrink-0 items-center justify-center rounded text-text-muted opacity-0 transition-opacity hover:bg-surface-raised hover:text-danger focus:opacity-100 group-hover:opacity-100 disabled:cursor-not-allowed"
                >
                  <i className="ti ti-x text-sm" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>

          {/* Stays enabled while saving: a disabled field would drop the focus
              between one item and the next. */}
          {checklistFull ? null : (
            <form onSubmit={handleAddItem} className="mt-1 flex items-center gap-2">
              <i className="ti ti-plus text-sm text-text-muted" aria-hidden="true" />
              <input
                value={newItem}
                maxLength={TASK_CHECKLIST_TEXT_MAX_LENGTH}
                placeholder="Adaugă un punct și apasă Enter"
                aria-label="Punct nou în checklist"
                onChange={(event) => setNewItem(event.target.value)}
                className="min-w-0 flex-1 border-b border-transparent bg-transparent py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                {...businessAutofill}
              />
            </form>
          )}
        </section>

        <section aria-labelledby="taskCommentsTitle">
          <h3 id="taskCommentsTitle" className={SECTION_TITLE_CLASS}>
            Comentarii
          </h3>
          <form onSubmit={handleAddComment} className="mt-2 flex items-start gap-2">
            <textarea
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
              className={`${FORM_FIELD_CLASS} min-h-[42px] resize-none`}
              {...businessAutofill}
            />
            <button
              type="submit"
              disabled={busy || !newComment.trim()}
              aria-label="Trimite comentariul"
              title="Trimite"
              className="flex size-[42px] shrink-0 items-center justify-center rounded-md border border-border text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <i className="ti ti-send text-base" aria-hidden="true" />
            </button>
          </form>

          {task.comments.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-3">
              {[...task.comments].reverse().map((comment) => (
                <li key={comment.id} className="text-sm">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium text-text-primary">
                      {formatPersonName(comment.author)}
                    </span>
                    <span className="text-xs text-text-muted">
                      {formatTaskTimestamp(comment.createdAt)}
                    </span>
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-text-secondary">
                    {comment.body}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section aria-labelledby="taskActivityTitle">
          <h3 id="taskActivityTitle" className={SECTION_TITLE_CLASS}>
            Activitate
          </h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {task.events.map((event) => (
              <li key={event.id} className="flex items-baseline justify-between gap-3 text-xs">
                <span className="min-w-0 text-text-secondary">
                  <span className="font-medium text-text-primary">
                    {event.actor ? formatPersonName(event.actor) : 'FabXpert'}
                  </span>{' '}
                  {describeEvent(event)}
                </span>
                <span className="shrink-0 text-text-muted">
                  {formatTaskTimestamp(event.createdAt)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-center gap-2 text-xs text-text-muted">
            Creat de <TaskAssignee user={task.createdBy} className="text-text-secondary" />
          </p>
        </section>
      </div>
    </SlideOverPanel>
  );
}

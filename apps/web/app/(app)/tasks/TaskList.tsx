'use client';

import {
  compareTasksByUrgency,
  getTaskStatusLabel,
  isTaskOverdue,
  type TaskDto,
  type TaskStatus,
} from '@fabxpert/shared';
import { useEffect, useRef, useState } from 'react';
import { TaskAssignee, TaskDueDate, TaskPriorityBadge, taskProjectLabel } from './taskDisplay';

interface TaskListProps {
  tasks: TaskDto[];
  /** Finished tasks are listed only when the page asked for them. */
  showDone: boolean;
  /** The task whose row is waiting for a change to be saved. */
  pendingTaskId: string | null;
  onOpen: (task: TaskDto) => void;
  onStatusChange: (task: TaskDto, status: TaskStatus) => void;
  onDelete: (task: TaskDto) => void;
}

const GROUPS: { status: TaskStatus; label: string; accent: string }[] = [
  { status: 'TODO', label: 'De făcut', accent: 'bg-info' },
  { status: 'IN_PROGRESS', label: 'În lucru', accent: 'bg-info' },
  { status: 'DONE', label: 'Finalizate', accent: 'bg-success' },
];

// Checkbox, title, project, assignee, deadline, priority, menu.
const ROW_GRID =
  'md:grid md:grid-cols-[16px_minmax(0,1fr)_minmax(0,220px)_minmax(0,170px)_104px_92px_32px] md:items-center md:gap-3';

/** The newest finished task first; open tasks by what needs doing first. */
function sortGroup(status: TaskStatus, tasks: TaskDto[]): TaskDto[] {
  return status === 'DONE'
    ? [...tasks].sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
    : [...tasks].sort(compareTasksByUrgency);
}

function statusIcon(task: TaskDto): { icon: string; className: string; label: string } {
  if (task.status === 'DONE') {
    return { icon: 'ti-circle-check', className: 'text-success', label: 'Finalizat' };
  }
  if (isTaskOverdue(task)) {
    return { icon: 'ti-alert-circle', className: 'text-danger-solid', label: 'Întârziat' };
  }
  return task.status === 'IN_PROGRESS'
    ? { icon: 'ti-progress', className: 'text-info', label: 'În lucru' }
    : { icon: 'ti-circle', className: 'text-text-disabled', label: 'De făcut' };
}

interface TaskRowMenuProps {
  task: TaskDto;
  onOpen: () => void;
  onStatusChange: (status: TaskStatus) => void;
  onDelete: () => void;
}

function TaskRowMenu({ task, onOpen, onStatusChange, onDelete }: TaskRowMenuProps) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setConfirmDelete(false);
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const itemClass =
    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-[var(--color-surface-popover-hover)]';
  const moves = (['TODO', 'IN_PROGRESS', 'DONE'] as const).filter(
    (status) => status !== task.status,
  );

  return (
    <div ref={containerRef} className="relative" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Acțiuni pentru „${task.title}”`}
        title="Acțiuni"
        onClick={() => setOpen((current) => !current)}
        className="flex size-8 items-center justify-center rounded text-text-muted hover:bg-surface-raised hover:text-text-primary"
      >
        <i className="ti ti-dots text-base" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 w-52 rounded-lg border border-border bg-surface-popover py-1 shadow-popover"
        >
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => {
              setOpen(false);
              onOpen();
            }}
          >
            <i
              className="ti ti-layout-sidebar-right text-base text-text-muted"
              aria-hidden="true"
            />
            Deschide
          </button>
          {moves.map((status) => (
            <button
              key={status}
              type="button"
              role="menuitem"
              className={itemClass}
              onClick={() => {
                setOpen(false);
                onStatusChange(status);
              }}
            >
              <i
                className={`ti ${status === 'DONE' ? 'ti-check' : 'ti-arrow-right'} text-base text-text-muted`}
                aria-hidden="true"
              />
              {status === 'DONE'
                ? 'Marchează finalizat'
                : `Mută în „${getTaskStatusLabel(status)}”`}
            </button>
          ))}
          <div className="my-1 border-t border-border-subtle" />
          <button
            type="button"
            role="menuitem"
            className={`${itemClass} !text-danger`}
            onClick={() => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                return;
              }
              setOpen(false);
              onDelete();
            }}
          >
            <i className="ti ti-trash text-base" aria-hidden="true" />
            {confirmDelete ? 'Confirmă ștergerea' : 'Șterge'}
          </button>
        </div>
      )}
    </div>
  );
}

interface TaskRowProps {
  task: TaskDto;
  pending: boolean;
  onOpen: () => void;
  onStatusChange: (status: TaskStatus) => void;
  onDelete: () => void;
}

function TaskRow({ task, pending, onOpen, onStatusChange, onDelete }: TaskRowProps) {
  const isDone = task.status === 'DONE';
  const icon = statusIcon(task);

  return (
    <li
      onClick={onOpen}
      className={`flex cursor-pointer items-start gap-3 border-t border-border-subtle px-3 py-2.5 text-sm transition-colors hover:bg-surface-hover ${ROW_GRID} ${
        pending ? 'opacity-60' : ''
      }`}
    >
      <input
        type="checkbox"
        checked={isDone}
        disabled={pending}
        aria-label={
          isDone ? `Redeschide „${task.title}”` : `Marchează „${task.title}” ca finalizat`
        }
        title={isDone ? 'Redeschide' : 'Marchează finalizat'}
        onClick={(event) => event.stopPropagation()}
        onChange={() => onStatusChange(isDone ? 'TODO' : 'DONE')}
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[var(--color-primary)] md:mt-0"
      />

      <div className="min-w-0 flex-1 md:contents">
        <div className="flex min-w-0 items-center gap-2">
          <i
            className={`ti ${icon.icon} shrink-0 text-base ${icon.className}`}
            title={icon.label}
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpen();
            }}
            className={`min-w-0 truncate text-left font-medium hover:underline ${
              isDone ? 'text-text-muted line-through' : 'text-text-primary'
            }`}
            title={task.title}
          >
            {task.title}
          </button>
          {task.checklistTotalCount > 0 ? (
            <span
              className="hidden shrink-0 items-center gap-1 text-xs tabular-nums text-text-muted sm:inline-flex"
              title="Checklist"
            >
              <i className="ti ti-checkbox text-sm" aria-hidden="true" />
              {task.checklistDoneCount}/{task.checklistTotalCount}
            </span>
          ) : null}
          {task.commentCount > 0 ? (
            <span
              className="hidden shrink-0 items-center gap-1 text-xs tabular-nums text-text-muted sm:inline-flex"
              title="Comentarii"
            >
              <i className="ti ti-message text-sm" aria-hidden="true" />
              {task.commentCount}
            </span>
          ) : null}
        </div>

        <span
          className="mt-0.5 block truncate text-xs text-text-secondary md:mt-0 md:text-sm"
          title={taskProjectLabel(task.project)}
        >
          {taskProjectLabel(task.project)}
        </span>

        {/* Phones: one meta line under the project. From `md` up: one cell each. */}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs md:contents md:text-sm">
          <TaskAssignee user={task.assignee} className="text-text-secondary" />
          <TaskDueDate task={task} />
          <span className="md:justify-self-start">
            <TaskPriorityBadge priority={task.priority} />
          </span>
        </div>
      </div>

      <TaskRowMenu
        task={task}
        onOpen={onOpen}
        onStatusChange={onStatusChange}
        onDelete={onDelete}
      />
    </li>
  );
}

/** Tasks grouped by status, each group sorted by what needs doing first. */
export function TaskList({
  tasks,
  showDone,
  pendingTaskId,
  onOpen,
  onStatusChange,
  onDelete,
}: TaskListProps) {
  const [doneCollapsed, setDoneCollapsed] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {GROUPS.filter((group) => showDone || group.status !== 'DONE').map((group) => {
        const groupTasks = sortGroup(
          group.status,
          tasks.filter((task) => task.status === group.status),
        );
        const collapsible = group.status === 'DONE';
        const collapsed = collapsible && doneCollapsed;

        return (
          <section
            key={group.status}
            aria-label={group.label}
            className="rounded-md border border-border-subtle bg-surface"
          >
            <header className={`flex items-center gap-3 px-3 py-2.5 ${ROW_GRID}`}>
              <span
                className={`h-5 w-1 shrink-0 rounded-full ${group.accent}`}
                aria-hidden="true"
              />
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {collapsible ? (
                  <button
                    type="button"
                    onClick={() => setDoneCollapsed((current) => !current)}
                    aria-expanded={!collapsed}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-text-primary"
                  >
                    {group.label}
                    <i
                      className={`ti ${collapsed ? 'ti-chevron-right' : 'ti-chevron-down'} text-sm text-text-muted`}
                      aria-hidden="true"
                    />
                  </button>
                ) : (
                  <h2 className="text-sm font-medium text-text-primary">{group.label}</h2>
                )}
                <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs tabular-nums text-text-secondary">
                  {groupTasks.length}
                </span>
              </div>
              {['Proiect', 'Responsabil', 'Termen', 'Prioritate'].map((label) => (
                <span key={label} className="hidden text-xs text-text-muted md:block">
                  {label}
                </span>
              ))}
              <span className="hidden md:block" aria-hidden="true" />
            </header>

            {collapsed ? null : groupTasks.length === 0 ? (
              <p className="border-t border-border-subtle px-3 py-4 text-sm text-text-muted">
                {group.status === 'DONE' ? 'Niciun task finalizat.' : 'Niciun task aici.'}
              </p>
            ) : (
              <ul>
                {groupTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    pending={pendingTaskId === task.id}
                    onOpen={() => onOpen(task)}
                    onStatusChange={(status) => onStatusChange(task, status)}
                    onDelete={() => onDelete(task)}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

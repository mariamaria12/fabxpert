'use client';

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  compareTasksByUrgency,
  formatPersonName,
  getTaskPriorityLabel,
  getTaskStatusLabel,
  type TaskDto,
  type TaskStatus,
} from '@fabxpert/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { getPersonInitials } from '@/components/PersonAvatar';
import { useIsMobile } from '@/hooks/useIsMobile';
import { TASK_PRIORITY_TONE, TaskDueDate, taskProjectLabel } from './taskDisplay';

interface TaskBoardProps {
  tasks: TaskDto[];
  /** The "Finalizate" column is there only when the page asked for finished tasks. */
  showDone: boolean;
  /** The task whose card is waiting for a change to be saved. */
  pendingTaskId: string | null;
  onOpen: (task: TaskDto) => void;
  onStatusChange: (task: TaskDto, status: TaskStatus) => void;
  onDelete: (task: TaskDto) => void;
}

const COLUMNS: { status: TaskStatus; label: string; accent: string }[] = [
  { status: 'TODO', label: 'De făcut', accent: 'bg-info' },
  { status: 'IN_PROGRESS', label: 'În lucru', accent: 'bg-warning' },
  { status: 'DONE', label: 'Finalizate', accent: 'bg-success' },
];

const CARD_CLASS =
  'rounded-md border border-border-subtle bg-surface-raised px-3 py-2.5 text-left shadow-sm';

/** The newest finished task first; open tasks by what needs doing first. */
function sortColumn(status: TaskStatus, tasks: TaskDto[]): TaskDto[] {
  return status === 'DONE'
    ? [...tasks].sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
    : [...tasks].sort(compareTasksByUrgency);
}

interface TaskCardMenuProps {
  task: TaskDto;
  onOpen: () => void;
  onStatusChange: (status: TaskStatus) => void;
  onDelete: () => void;
}

function TaskCardMenu({ task, onOpen, onStatusChange, onDelete }: TaskCardMenuProps) {
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
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Acțiuni pentru „${task.title}”`}
        title="Acțiuni"
        onClick={() => setOpen((current) => !current)}
        className="flex size-7 items-center justify-center rounded text-text-muted hover:bg-surface-hover hover:text-text-primary"
      >
        <i className="ti ti-dots text-base" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 w-48 rounded-lg border border-border bg-surface-popover py-1 shadow-popover"
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

/** What a card shows — shared by the card in its column and the one being dragged. */
function TaskCardContent({ task }: { task: TaskDto }) {
  const isDone = task.status === 'DONE';
  const priorityLabel = getTaskPriorityLabel(task.priority).toLowerCase();

  return (
    <>
      {/* Right padding leaves room for the menu button laid over the corner. */}
      <p
        className={`line-clamp-2 break-words pr-7 text-sm font-medium ${
          isDone ? 'text-text-muted line-through' : 'text-text-primary'
        }`}
      >
        {task.title}
      </p>
      <p className="mt-0.5 truncate text-xs text-text-secondary">
        {taskProjectLabel(task.project)}
      </p>
      <div className="mt-2.5 flex items-center gap-2.5 text-xs text-text-muted">
        <span
          className={`size-2.5 shrink-0 rounded-full ${TASK_PRIORITY_TONE[task.priority].solid}`}
          title={`Prioritate: ${priorityLabel}`}
        >
          <span className="sr-only">Prioritate {priorityLabel}</span>
        </span>
        {task.dueDate ? <TaskDueDate task={task} /> : null}
        {task.checklistTotalCount > 0 ? (
          <span className="inline-flex items-center gap-1 tabular-nums" title="Checklist">
            <i className="ti ti-checkbox text-sm" aria-hidden="true" />
            {task.checklistDoneCount}/{task.checklistTotalCount}
          </span>
        ) : null}
        {task.commentCount > 0 ? (
          <span className="inline-flex items-center gap-1 tabular-nums" title="Comentarii">
            <i className="ti ti-message text-sm" aria-hidden="true" />
            {task.commentCount}
          </span>
        ) : null}
        <span
          className="ml-auto flex size-6 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface text-[10px] font-medium text-text-secondary"
          title={formatPersonName(task.assignee)}
        >
          <span aria-hidden="true">{getPersonInitials(task.assignee)}</span>
          <span className="sr-only">{formatPersonName(task.assignee)}</span>
        </span>
      </div>
    </>
  );
}

interface TaskCardProps {
  task: TaskDto;
  pending: boolean;
  onOpen: () => void;
  onStatusChange: (status: TaskStatus) => void;
  onDelete: () => void;
}

function TaskCard({ task, pending, onOpen, onStatusChange, onDelete }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    disabled: pending,
  });

  return (
    <li
      ref={setNodeRef}
      className={`relative ${isDragging ? 'opacity-40' : pending ? 'opacity-60' : ''}`}
    >
      <div
        {...attributes}
        {...listeners}
        onClick={onOpen}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            onOpen();
          }
        }}
        className={`${CARD_CLASS} cursor-grab touch-manipulation transition-colors hover:border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40`}
      >
        <TaskCardContent task={task} />
      </div>
      {/* Beside the card, not inside it: a press on the menu must not start a drag. */}
      <div className="absolute right-1 top-1.5">
        <TaskCardMenu
          task={task}
          onOpen={onOpen}
          onStatusChange={onStatusChange}
          onDelete={onDelete}
        />
      </div>
    </li>
  );
}

interface TaskColumnProps {
  status: TaskStatus;
  label: string;
  accent: string;
  tasks: TaskDto[];
  /** A card from another column is in the air, so this one can take it. */
  accepting: boolean;
  renderCard: (task: TaskDto) => ReactNode;
}

function TaskColumn({ status, label, accent, tasks, accepting, renderCard }: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      className={`flex w-[85%] shrink-0 snap-start flex-col rounded-lg border bg-surface p-2 transition-colors md:w-auto md:shrink ${
        accepting && isOver
          ? 'border-accent bg-[var(--color-accent-tint)]'
          : accepting
            ? 'border-dashed border-border'
            : 'border-border-subtle'
      }`}
    >
      <header className="flex items-center gap-2 px-1 pb-2 pt-1">
        <span className={`h-4 w-1 shrink-0 rounded-full ${accent}`} aria-hidden="true" />
        <h2 className="text-sm font-medium text-text-primary">{label}</h2>
        <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs tabular-nums text-text-secondary">
          {tasks.length}
        </span>
      </header>

      {tasks.length === 0 ? (
        <p className="flex min-h-24 flex-1 items-center justify-center rounded-md border border-dashed border-border-subtle px-3 text-center text-xs text-text-muted">
          {accepting ? 'Lasă task-ul aici' : 'Niciun task aici.'}
        </p>
      ) : (
        <ul className="flex min-h-24 flex-1 flex-col gap-2">{tasks.map(renderCard)}</ul>
      )}
    </section>
  );
}

/**
 * Tasks as a board: one column per status, each sorted by what needs doing
 * first. Dragging a card to another column changes its status; the card's menu
 * does the same without a drag.
 */
export function TaskBoard({
  tasks,
  showDone,
  pendingTaskId,
  onOpen,
  onStatusChange,
  onDelete,
}: TaskBoardProps) {
  const isMobile = useIsMobile();
  const [draggedTask, setDraggedTask] = useState<TaskDto | null>(null);

  // A short move starts a drag with the mouse; a finger has to rest first, so
  // swiping between columns still scrolls.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: isMobile ? { delay: 350, tolerance: 8 } : { distance: 6 },
    }),
  );

  const columns = COLUMNS.filter((column) => showDone || column.status !== 'DONE');

  function handleDragEnd(event: DragEndEvent) {
    const task = draggedTask;
    setDraggedTask(null);
    const status = event.over?.id as TaskStatus | undefined;
    if (task && status && status !== task.status) {
      onStatusChange(task, status);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(event) =>
        setDraggedTask(tasks.find((task) => task.id === event.active.id) ?? null)
      }
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggedTask(null)}
    >
      <div
        className={`flex snap-x items-start gap-3 overflow-x-auto pb-2 md:grid md:overflow-visible md:pb-0 ${
          columns.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'
        }`}
      >
        {columns.map((column) => (
          <TaskColumn
            key={column.status}
            status={column.status}
            label={column.label}
            accent={column.accent}
            tasks={sortColumn(
              column.status,
              tasks.filter((task) => task.status === column.status),
            )}
            accepting={draggedTask !== null && draggedTask.status !== column.status}
            renderCard={(task) => (
              <TaskCard
                key={task.id}
                task={task}
                pending={pendingTaskId === task.id}
                onOpen={() => onOpen(task)}
                onStatusChange={(status) => onStatusChange(task, status)}
                onDelete={() => onDelete(task)}
              />
            )}
          />
        ))}
      </div>

      <DragOverlay>
        {draggedTask ? (
          <div className={`${CARD_CLASS} rotate-2 cursor-grabbing border-accent shadow-popover`}>
            <TaskCardContent task={draggedTask} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

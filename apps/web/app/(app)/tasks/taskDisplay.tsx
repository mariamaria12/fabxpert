import {
  formatPersonName,
  formatTaskDueDate,
  getTaskPriorityLabel,
  taskDueState,
  type TaskDto,
  type TaskPriority,
  type TaskProjectDto,
  type TaskUserDto,
} from '@fabxpert/shared';
import { getPersonInitials } from '@/components/PersonAvatar';

/**
 * "BT_Cluj-Napoca · MIMO": the code and the client, as the project pickers
 * show them. The full project name is too long for a list row.
 */
export function taskProjectLabel(project: TaskProjectDto): string {
  const code = project.code || project.name;
  return project.companyName ? `${code} · ${project.companyName}` : code;
}

const PRIORITY_BADGE_CLASS: Record<TaskPriority, string> = {
  URGENT: 'border-danger-border bg-danger-bg text-danger-text',
  HIGH: 'border-warning-border bg-warning-bg text-warning-text',
  // Normal stays quiet on purpose: most tasks are, and the list should not shout.
  NORMAL: 'border-border-subtle bg-surface-sunken text-text-secondary',
};

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded border px-2 py-0.5 text-xs font-medium ${PRIORITY_BADGE_CLASS[priority]}`}
    >
      {getTaskPriorityLabel(priority)}
    </span>
  );
}

/** The deadline as a day name or date: red when overdue, amber when due today. */
export function TaskDueDate({
  task,
  className = '',
}: {
  task: Pick<TaskDto, 'dueDate' | 'status'>;
  className?: string;
}) {
  if (!task.dueDate) {
    return <span className={`text-text-disabled ${className}`}>—</span>;
  }

  const state = taskDueState(task);
  const tone =
    state === 'overdue'
      ? 'text-danger font-medium'
      : state === 'today'
        ? 'text-warning-text font-medium'
        : 'text-text-secondary';

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap ${tone} ${className}`}
      title={state === 'overdue' ? 'Întârziat' : undefined}
    >
      <i
        className={`ti ${state === 'overdue' ? 'ti-calendar-exclamation' : 'ti-calendar'} text-sm`}
        aria-hidden="true"
      />
      {formatTaskDueDate(task.dueDate)}
      {state === 'overdue' ? <span className="sr-only"> (întârziat)</span> : null}
    </span>
  );
}

export function TaskAssignee({ user, className = '' }: { user: TaskUserDto; className?: string }) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      <span
        className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface-raised text-[10px] font-medium text-text-secondary"
        aria-hidden="true"
      >
        {getPersonInitials(user)}
      </span>
      <span className="truncate">{formatPersonName(user)}</span>
    </span>
  );
}

import {
  formatPersonName,
  formatTaskDueDate,
  getTaskPriorityLabel,
  TASK_PRIORITY_VALUES,
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

/** "3 oct., 10:32" — the year only when it is not this one. */
export function formatTaskTimestamp(iso: string): string {
  const date = new Date(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  const day = date.toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  const time = date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  return `${day}, ${time}`;
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

/**
 * The color a priority wears wherever it is shown at full strength: the picker,
 * the message bubble and the dots on the panou. `surface` tints a block, `solid`
 * is its dot.
 */
export const TASK_PRIORITY_TONE: Record<
  TaskPriority,
  { surface: string; solid: string; text: string; icon: string }
> = {
  NORMAL: {
    surface: 'border-info-border bg-info-bg',
    solid: 'bg-info',
    text: 'text-info-text',
    icon: 'ti-leaf',
  },
  HIGH: {
    surface: 'border-warning-border bg-warning-bg',
    solid: 'bg-warning',
    text: 'text-warning-text',
    icon: 'ti-bolt',
  },
  URGENT: {
    surface: 'border-danger-border bg-danger-bg',
    solid: 'bg-danger-solid',
    text: 'text-danger-text',
    icon: 'ti-flame',
  },
};

/** Priority as three colored pills, one of them lit. */
export function TaskPriorityPicker({
  value,
  disabled = false,
  onChange,
}: {
  value: TaskPriority;
  disabled?: boolean;
  onChange: (priority: TaskPriority) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Prioritate" className="grid grid-cols-3 gap-1.5 sm:gap-2">
      {TASK_PRIORITY_VALUES.map((priority) => {
        const tone = TASK_PRIORITY_TONE[priority];
        const selected = priority === value;
        return (
          <button
            key={priority}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(priority)}
            className={`flex min-w-0 items-center justify-center gap-1 rounded-full border px-1.5 py-2 text-[13px] font-medium sm:gap-1.5 sm:px-3 sm:text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-60 ${
              selected
                ? `${tone.surface} ${tone.text} shadow-sm`
                : 'border-border bg-transparent text-text-secondary hover:border-text-muted/40 hover:text-text-primary'
            }`}
          >
            {selected ? (
              <i className={`ti ${tone.icon} shrink-0 text-sm sm:text-base`} aria-hidden="true" />
            ) : (
              <span className={`size-2 shrink-0 rounded-full ${tone.solid}`} aria-hidden="true" />
            )}
            {getTaskPriorityLabel(priority)}
          </button>
        );
      })}
    </div>
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

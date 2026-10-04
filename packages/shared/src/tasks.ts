import type { TaskPriority, TaskStatus } from './dto/task.dto';
import { parseWorkDateString, todayDateInputValue, workDateToDayKey } from './workDate';

export function getTaskStatusLabel(status: TaskStatus): string {
  switch (status) {
    case 'TODO':
      return 'De făcut';
    case 'IN_PROGRESS':
      return 'În lucru';
    case 'DONE':
      return 'Finalizat';
    default:
      return status;
  }
}

export function getTaskPriorityLabel(priority: TaskPriority): string {
  switch (priority) {
    case 'NORMAL':
      return 'Normală';
    case 'HIGH':
      return 'Ridicată';
    case 'URGENT':
      return 'Urgentă';
    default:
      return priority;
  }
}

/** Where a task's deadline stands against today. `none` is a task with no deadline. */
export type TaskDueState = 'overdue' | 'today' | 'tomorrow' | 'thisWeek' | 'later' | 'none';

type TaskDeadline = { dueDate: string | null; status: TaskStatus };

function addDays(dayKey: string, days: number): string {
  const date = parseWorkDateString(dayKey);
  date.setDate(date.getDate() + days);
  return workDateToDayKey(date);
}

/** The Sunday closing the week `dayKey` is in — weeks run Monday to Sunday. */
function endOfWeek(dayKey: string): string {
  const weekday = parseWorkDateString(dayKey).getDay();
  return addDays(dayKey, weekday === 0 ? 0 : 7 - weekday);
}

/**
 * Overdue is never stored: it is a deadline in the past on a task that is not
 * finished. A finished task is never overdue, whatever its deadline was.
 */
export function taskDueState(task: TaskDeadline, today = todayDateInputValue()): TaskDueState {
  if (!task.dueDate) {
    return 'none';
  }
  if (task.status === 'DONE') {
    return 'later';
  }
  if (task.dueDate < today) {
    return 'overdue';
  }
  if (task.dueDate === today) {
    return 'today';
  }
  if (task.dueDate === addDays(today, 1)) {
    return 'tomorrow';
  }
  return task.dueDate <= endOfWeek(today) ? 'thisWeek' : 'later';
}

export function isTaskOverdue(task: TaskDeadline, today = todayDateInputValue()): boolean {
  return taskDueState(task, today) === 'overdue';
}

/** Overdue or due today — what the sidebar badge and the summary count. */
export function taskNeedsAttention(task: TaskDeadline, today = todayDateInputValue()): boolean {
  const state = taskDueState(task, today);
  return state === 'overdue' || state === 'today';
}

/** A deadline as the lists show it: "Ieri", "Azi", "Mâine", "8 oct." or "8 oct. 2025". */
export function formatTaskDueDate(dueDate: string, today = todayDateInputValue()): string {
  if (dueDate === today) {
    return 'Azi';
  }
  if (dueDate === addDays(today, -1)) {
    return 'Ieri';
  }
  if (dueDate === addDays(today, 1)) {
    return 'Mâine';
  }

  const date = parseWorkDateString(dueDate);
  const sameYear = dueDate.slice(0, 4) === today.slice(0, 4);
  return date.toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

const PRIORITY_RANK: Record<TaskPriority, number> = { URGENT: 0, HIGH: 1, NORMAL: 2 };

/**
 * What to do first: the earliest deadline, then the higher priority. Tasks
 * with no deadline go last.
 */
export function compareTasksByUrgency(
  a: TaskDeadline & { priority: TaskPriority },
  b: TaskDeadline & { priority: TaskPriority },
): number {
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === null) {
      return 1;
    }
    if (b.dueDate === null) {
      return -1;
    }
    return a.dueDate < b.dueDate ? -1 : 1;
  }
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
}

export function formatTaskCount(count: number): string {
  if (count === 1) {
    return '1 task';
  }
  // Romanian puts "de" after numbers ending in 00 or 20–99.
  const lastTwo = count % 100;
  return count >= 20 && (lastTwo === 0 || lastTwo >= 20)
    ? `${count} de task-uri`
    : `${count} task-uri`;
}

import { formatPersonName, taskDueState, type TaskDto, type TaskStatus } from '@fabxpert/shared';
import { normalizeSearchText } from '@/utils/searchText';
import { taskProjectLabel } from './taskDisplay';

/** `week` is everything due from tomorrow to Sunday; `none` has no deadline. */
export type TaskDueFilter = '' | 'overdue' | 'today' | 'week' | 'none';

/** Open statuses only — finished tasks have their own switch. */
export type TaskStatusFilter = '' | Exclude<TaskStatus, 'DONE'>;

export type TaskFilters = {
  assigneeUserId: string | null;
  status: TaskStatusFilter;
  due: TaskDueFilter;
  search: string;
};

function matchesDue(task: TaskDto, due: TaskDueFilter, today: string): boolean {
  if (due === '') {
    return true;
  }
  if (task.status === 'DONE') {
    return false;
  }

  const state = taskDueState(task, today);
  switch (due) {
    case 'overdue':
      return state === 'overdue';
    case 'today':
      return state === 'today';
    case 'week':
      return state === 'tomorrow' || state === 'thisWeek';
    case 'none':
      return state === 'none';
    default:
      return true;
  }
}

/** Narrows the loaded tasks to what the filter row asks for. */
export function filterTasks(tasks: TaskDto[], filters: TaskFilters, today: string): TaskDto[] {
  const query = normalizeSearchText(filters.search);

  return tasks.filter((task) => {
    if (filters.assigneeUserId && task.assignee.id !== filters.assigneeUserId) {
      return false;
    }
    // The status filter picks among open tasks; finished ones stay in their group.
    if (filters.status && task.status !== 'DONE' && task.status !== filters.status) {
      return false;
    }
    if (!matchesDue(task, filters.due, today)) {
      return false;
    }
    if (!query) {
      return true;
    }

    const haystack = normalizeSearchText(
      [task.title, taskProjectLabel(task.project), formatPersonName(task.assignee)].join(' '),
    );
    return haystack.includes(query);
  });
}

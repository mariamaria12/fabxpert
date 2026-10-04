/**
 * Link to the task page: on one project, with a task open, or with the
 * "Task nou" panel already started.
 */
export function taskHref(
  target: { taskId?: string; projectId?: string; create?: boolean } = {},
): string {
  const params = new URLSearchParams();
  if (target.projectId) {
    params.set('project', target.projectId);
  }
  if (target.taskId) {
    params.set('task', target.taskId);
  }
  if (target.create) {
    params.set('new', '1');
  }

  const query = params.toString();
  return query ? `/tasks?${query}` : '/tasks';
}

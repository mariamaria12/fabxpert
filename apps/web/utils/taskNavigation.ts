/**
 * Link to the task page: on one project, with a task open, or with the
 * "Task nou" panel already started. `returnAfter` marks a link followed from
 * a project elsewhere: the page offers "Înapoi la proiect", and a "Task nou"
 * started by the link goes back there on its own once saved or closed.
 */
export function taskHref(
  target: { taskId?: string; projectId?: string; create?: boolean; returnAfter?: boolean } = {},
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
  if (target.returnAfter) {
    params.set('back', '1');
  }

  const query = params.toString();
  return query ? `/tasks?${query}` : '/tasks';
}

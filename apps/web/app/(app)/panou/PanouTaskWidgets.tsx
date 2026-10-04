'use client';

import {
  compareTasksByUrgency,
  formatTaskCount,
  listTasks,
  isTaskOverdue,
  type TaskDto,
} from '@fabxpert/shared';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useReloadOnTasksChanged, useTasks } from '@/context/TasksContext';
import { taskHref } from '@/utils/taskNavigation';
import { TaskDueDate, taskProjectLabel } from '../tasks/taskDisplay';

/** The widget answers "what do I do now" — a few rows, not the whole list. */
const MY_TASKS_LIMIT = 5;
const ATTENTION_PROJECTS_LIMIT = 4;

const CARD_CLASS = 'rounded-lg border border-border-subtle bg-surface';
const HEADER_LINK_CLASS = 'text-xs text-info-text hover:underline';

function WidgetHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <h2 className="flex items-center gap-2 text-sm font-medium text-text-primary">
        {title}
        {count ? (
          <span className="rounded-full bg-surface-sunken px-1.5 py-0.5 text-[11px] font-normal tabular-nums text-text-secondary">
            {count}
          </span>
        ) : null}
      </h2>
      <Link href={taskHref()} className={HEADER_LINK_CLASS}>
        Vezi toate →
      </Link>
    </div>
  );
}

/**
 * The signed-in admin's next tasks, and the projects held up by overdue ones.
 * Each card only appears while it has something to show.
 */
export function PanouTaskWidgets() {
  const { projectTaskCounts } = useTasks();
  const [tasks, setTasks] = useState<TaskDto[] | null>(null);

  const load = useCallback(async () => {
    try {
      setTasks(await listTasks({ scope: 'mine' }));
    } catch {
      // The widget is a shortcut; the task page reports real errors.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useReloadOnTasksChanged(() => void load());

  const nextTasks = useMemo(
    () => (tasks ? [...tasks].sort(compareTasksByUrgency).slice(0, MY_TASKS_LIMIT) : []),
    [tasks],
  );

  // The context keeps the counts sorted, the most overdue project first.
  const attentionProjects = useMemo(
    () => [...projectTaskCounts.values()].filter((counts) => counts.overdueCount > 0),
    [projectTaskCounts],
  );

  const hasTasks = nextTasks.length > 0;
  const hasAttentionProjects = attentionProjects.length > 0;

  if (!hasTasks && !hasAttentionProjects) return null;

  return (
    <div
      className={`mt-3 grid gap-3 ${hasTasks && hasAttentionProjects ? 'lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]' : ''}`}
    >
      {hasTasks ? (
        <section aria-label="Task-urile mele" className={CARD_CLASS}>
          <WidgetHeader title="Task-urile mele" count={tasks?.length} />
          <ul>
            {nextTasks.map((task) => (
              <li key={task.id} className="border-t border-border-subtle">
                <Link
                  href={taskHref({ taskId: task.id })}
                  className="flex items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-surface-hover"
                >
                  <i
                    className={`ti shrink-0 text-base ${
                      isTaskOverdue(task)
                        ? 'ti-alert-circle text-danger-solid'
                        : task.status === 'IN_PROGRESS'
                          ? 'ti-progress text-info'
                          : 'ti-circle text-text-disabled'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-text-primary">
                      {task.title}
                    </span>
                    <span className="block truncate text-xs text-text-muted">
                      {taskProjectLabel(task.project)}
                    </span>
                  </span>
                  <TaskDueDate task={task} className="shrink-0 text-xs" />
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-3 border-t border-border-subtle px-3 py-2">
            <Link
              href={taskHref({ create: true })}
              className="inline-flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary"
            >
              <i className="ti ti-plus text-base" aria-hidden="true" />
              Task nou
            </Link>
            {tasks && tasks.length > nextTasks.length ? (
              <span className="text-xs text-text-muted">
                încă {formatTaskCount(tasks.length - nextTasks.length)}
              </span>
            ) : null}
          </div>
        </section>
      ) : null}

      {hasAttentionProjects ? (
        <section aria-label="Proiecte cu task-uri în atenție" className={CARD_CLASS}>
          <WidgetHeader title="Proiecte cu task-uri în atenție" />
          <ul>
            {attentionProjects
              .slice(0, ATTENTION_PROJECTS_LIMIT)
              .map(({ project, overdueCount }) => (
                <li key={project.id} className="border-t border-border-subtle">
                  <Link
                    href={taskHref({ projectId: project.id })}
                    className="flex items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-surface-hover"
                  >
                    <i
                      className="ti ti-alert-triangle shrink-0 text-base text-danger"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-text-primary">
                        {taskProjectLabel(project)}
                      </span>
                      <span className="block text-xs text-danger">
                        {overdueCount === 1
                          ? '1 task întârziat'
                          : `${formatTaskCount(overdueCount)} întârziate`}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
          {attentionProjects.length > ATTENTION_PROJECTS_LIMIT ? (
            <p className="border-t border-border-subtle px-3 py-2 text-xs text-text-muted">
              și încă {attentionProjects.length - ATTENTION_PROJECTS_LIMIT} proiecte
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

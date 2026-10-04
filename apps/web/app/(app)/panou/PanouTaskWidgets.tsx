'use client';

import {
  compareTasksByUrgency,
  formatTaskCount,
  getTaskPriorityLabel,
  listTasks,
  updateTask,
  type TaskDto,
} from '@fabxpert/shared';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useReloadOnTasksChanged, useTasks } from '@/context/TasksContext';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { taskHref } from '@/utils/taskNavigation';
import { TASK_PRIORITY_TONE, TaskDueDate, taskProjectLabel } from '../tasks/taskDisplay';
import { TaskPreviewDialog } from '../tasks/TaskPreviewDialog';

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
  const { showToast } = useToast();
  const [tasks, setTasks] = useState<TaskDto[] | null>(null);
  // Ticked here and on their way out: shown struck through until the list reloads.
  const [finishingTaskIds, setFinishingTaskIds] = useState<ReadonlySet<string>>(new Set());
  const [openTask, setOpenTask] = useState<TaskDto | null>(null);

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

  async function finishTask(task: TaskDto) {
    setFinishingTaskIds((current) => new Set(current).add(task.id));
    try {
      await updateTask(task.id, { status: 'DONE' });
      await load();
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setFinishingTaskIds((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
    }
  }

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

  return (
    <>
      {hasTasks || hasAttentionProjects ? (
        <div
          className={`mt-3 grid grid-cols-1 gap-3 ${hasTasks && hasAttentionProjects ? 'lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]' : ''}`}
        >
          {hasTasks ? (
            <section aria-label="Task-urile mele" className={CARD_CLASS}>
              <WidgetHeader title="Task-urile mele" count={tasks?.length} />
              <ul className="flex flex-col gap-1.5 px-3 pb-2">
                {nextTasks.map((task) => {
                  const tone = TASK_PRIORITY_TONE[task.priority];
                  const priorityLabel = getTaskPriorityLabel(task.priority).toLowerCase();
                  const finishing = finishingTaskIds.has(task.id);
                  return (
                    <li
                      key={task.id}
                      className={`flex items-center gap-3 rounded-md border border-border-subtle bg-surface-raised py-2 pl-3 pr-2 text-sm transition hover:border-border ${
                        finishing ? 'opacity-60' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={finishing}
                        disabled={finishing}
                        aria-label={`Marchează „${task.title}” ca finalizat`}
                        title="Marchează finalizat"
                        onChange={() => void finishTask(task)}
                        className="size-4 shrink-0 cursor-pointer accent-[var(--color-primary)]"
                      />
                      <button
                        type="button"
                        onClick={() => setOpenTask(task)}
                        aria-haspopup="dialog"
                        title="Vezi detalii și comentarii"
                        className="flex min-w-0 flex-1 items-center gap-3 rounded text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                      >
                        <span className={`size-2.5 shrink-0 rounded-full ${tone.solid}`}>
                          <span className="sr-only">Prioritate {priorityLabel}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block truncate font-medium text-text-primary ${
                              finishing ? 'line-through' : ''
                            }`}
                          >
                            {task.title}
                          </span>
                          <span className="flex items-center gap-2 text-xs text-text-secondary">
                            <span className="min-w-0 truncate">
                              {taskProjectLabel(task.project)}
                            </span>
                            {/* On a phone the deadline sits under the title, which needs the width. */}
                            {task.dueDate ? (
                              <span className="shrink-0 sm:hidden">
                                <TaskDueDate task={task} />
                              </span>
                            ) : null}
                          </span>
                        </span>
                        {task.commentCount > 0 ? (
                          <span className="inline-flex shrink-0 items-center gap-1 text-xs tabular-nums text-text-muted">
                            <i className="ti ti-message text-sm" aria-hidden="true" />
                            {task.commentCount}
                            <span className="sr-only"> comentarii</span>
                          </span>
                        ) : null}
                        <span className="hidden shrink-0 text-xs sm:block">
                          <TaskDueDate task={task} />
                        </span>
                      </button>
                      <Link
                        href={taskHref({ taskId: task.id })}
                        aria-label={`Editează „${task.title}”`}
                        title="Editează"
                        className="flex size-7 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
                      >
                        <i className="ti ti-pencil text-base" aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {tasks && tasks.length > nextTasks.length ? (
                <p className="px-3 pb-2 text-xs text-text-muted">
                  încă {formatTaskCount(tasks.length - nextTasks.length)}
                </p>
              ) : null}
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
      ) : null}

      {/* Outside the cards: a task finished while it is open must not close it. */}
      {openTask ? <TaskPreviewDialog task={openTask} onClose={() => setOpenTask(null)} /> : null}
    </>
  );
}

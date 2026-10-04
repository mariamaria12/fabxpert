'use client';

import {
  deleteTask,
  listTasks,
  TASK_DONE_LIST_LIMIT,
  taskDueState,
  todayDateInputValue,
  updateTask,
  type TaskDto,
  type TaskListScope,
  type TaskStatus,
} from '@fabxpert/shared';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchAutofillProps } from '@/components/inputAutofill';
import { SearchableSelect } from '@/components/SearchableSelect';
import { SelectField } from '@/components/SelectField';
import { useReloadOnTasksChanged } from '@/context/TasksContext';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { TaskAttentionSummary } from './TaskAttentionSummary';
import { TaskDetailPanel } from './TaskDetailPanel';
import { TaskFormPanel } from './TaskFormPanel';
import { TaskList } from './TaskList';
import { filterTasks, type TaskDueFilter, type TaskStatusFilter } from './taskFilters';
import { useTaskLookups } from './useTaskLookups';

const SCOPE_TABS: { id: TaskListScope; label: string }[] = [
  { id: 'mine', label: 'Ale mele' },
  { id: 'all', label: 'Toate' },
];

const STATUS_FILTER_OPTIONS = [
  { id: 'TODO', label: 'De făcut' },
  { id: 'IN_PROGRESS', label: 'În lucru' },
];

const DUE_FILTER_OPTIONS = [
  { id: 'overdue', label: 'Întârziate' },
  { id: 'today', label: 'Astăzi' },
  { id: 'week', label: 'Săptămâna aceasta' },
  { id: 'none', label: 'Fără termen' },
];

/**
 * Who has to do what, for which project, by when. `?project=` keeps the page
 * on one project, `?task=` opens a task and `?new=1` starts a new one — the
 * links other screens and the notifications use.
 */
export default function TasksPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const searchAutofill = useSearchAutofillProps();
  const lookups = useTaskLookups();

  const projectId = searchParams.get('project');
  const openTaskId = searchParams.get('task');
  const creating = searchParams.get('new') === '1';

  // Coming in on a project, everyone's tasks on it are what was asked for.
  const [scope, setScope] = useState<TaskListScope>(projectId ? 'all' : 'mine');
  const [includeDone, setIncludeDone] = useState(true);
  const [assigneeUserId, setAssigneeUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<TaskStatusFilter>('');
  const [due, setDue] = useState<TaskDueFilter>('');
  const [search, setSearch] = useState('');

  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const requestRef = useRef(0);

  const setParams = useCallback(
    (changes: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === null) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      const query = params.toString();
      router.replace(query ? `/tasks?${query}` : '/tasks');
    },
    [router, searchParams],
  );

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    try {
      const loaded = await listTasks({ scope, projectId: projectId ?? undefined, includeDone });
      // A slower, older answer must not replace a newer one.
      if (requestId === requestRef.current) {
        setTasks(loaded);
        setFailed(false);
      }
    } catch {
      if (requestId === requestRef.current) {
        setFailed(true);
      }
    } finally {
      if (requestId === requestRef.current) {
        setLoading(false);
      }
    }
  }, [scope, projectId, includeDone]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useReloadOnTasksChanged(() => void load());

  const today = todayDateInputValue();

  // The summary counts what is in scope, whatever the filter row narrows to.
  const attention = useMemo(() => {
    const counts = { overdue: 0, today: 0, thisWeek: 0 };
    for (const task of tasks) {
      const state = taskDueState(task, today);
      if (state === 'overdue') {
        counts.overdue += 1;
      } else if (state === 'today') {
        counts.today += 1;
      } else if (state === 'tomorrow' || state === 'thisWeek') {
        counts.thisWeek += 1;
      }
    }
    return counts;
  }, [tasks, today]);

  const visibleTasks = useMemo(
    () =>
      filterTasks(
        tasks,
        { assigneeUserId: scope === 'all' ? assigneeUserId : null, status, due, search },
        today,
      ),
    [tasks, scope, assigneeUserId, status, due, search, today],
  );

  async function handleStatusChange(task: TaskDto, nextStatus: TaskStatus) {
    setPendingTaskId(task.id);
    try {
      await updateTask(task.id, { status: nextStatus });
      await load();
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setPendingTaskId(null);
    }
  }

  async function handleDelete(task: TaskDto) {
    setPendingTaskId(task.id);
    try {
      await deleteTask(task.id);
      showToast('Task-ul a fost șters.', 'success');
      await load();
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setPendingTaskId(null);
    }
  }

  // The API hands over the latest finished tasks only; older ones are not here to be found.
  const doneListCut =
    includeDone && tasks.filter((task) => task.status === 'DONE').length >= TASK_DONE_LIST_LIMIT;

  const hasFilters = Boolean(
    projectId || (scope === 'all' && assigneeUserId) || status || due || search.trim(),
  );
  const nothingToShow = !loading && !failed && visibleTasks.length === 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="hidden min-w-0 sm:block">
          <h1 className="text-[22px] font-medium text-text-primary">Task-uri</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            Toate task-urile tale și ale echipei, organizate pe proiecte.
          </p>
        </div>
        <div className="flex w-full items-center gap-3 sm:w-auto">
          <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
            <i
              className="ti ti-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Caută task-uri…"
              aria-label="Caută task-uri"
              className="w-full rounded-md border border-border bg-surface-raised py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              {...searchAutofill}
            />
          </div>
          <button
            type="button"
            onClick={() => setParams({ new: '1' })}
            className="inline-flex shrink-0 items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90 sm:px-4"
          >
            <i className="ti ti-plus text-base" aria-hidden="true" />
            Task nou
          </button>
        </div>
      </div>

      <div className="mt-4 flex gap-1 border-b border-border-subtle">
        {SCOPE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setScope(tab.id)}
            aria-pressed={scope === tab.id}
            className={`border-b-2 px-4 py-2 text-sm transition-colors ${
              scope === tab.id
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 items-end gap-3 md:flex md:flex-wrap">
        <div className="col-span-2 md:w-64">
          <SearchableSelect
            id="taskFilterProject"
            label="Proiect"
            value={projectId}
            options={lookups.projectOptions}
            placeholder="Toate proiectele"
            onChange={(next) => setParams({ project: next })}
          />
        </div>
        {scope === 'all' ? (
          <div className="col-span-2 md:w-52">
            <SearchableSelect
              id="taskFilterAssignee"
              label="Responsabil"
              value={assigneeUserId}
              options={lookups.assigneeOptions}
              placeholder="Toți"
              onChange={setAssigneeUserId}
            />
          </div>
        ) : null}
        <div className="md:w-40">
          <SelectField
            id="taskFilterStatus"
            label="Status"
            value={status}
            options={STATUS_FILTER_OPTIONS}
            allowEmpty
            placeholder="Active"
            onChange={(next) => setStatus(next as TaskStatusFilter)}
          />
        </div>
        <div className="md:w-48">
          <SelectField
            id="taskFilterDue"
            label="Termen"
            value={due}
            options={DUE_FILTER_OPTIONS}
            allowEmpty
            placeholder="Toate"
            onChange={(next) => setDue(next as TaskDueFilter)}
          />
        </div>
        <label className="col-span-2 flex cursor-pointer items-center gap-2 py-2.5 text-sm text-text-secondary md:col-span-1">
          <input
            type="checkbox"
            checked={includeDone}
            onChange={(event) => setIncludeDone(event.target.checked)}
            className="size-4 accent-[var(--color-primary)]"
          />
          Include finalizate
        </label>
      </div>

      <div className="mt-4">
        <TaskAttentionSummary
          overdueCount={attention.overdue}
          todayCount={attention.today}
          thisWeekCount={attention.thisWeek}
          activeFilter={due}
          onFilter={setDue}
        />
      </div>

      <div className="mt-4 flex-1">
        {failed ? (
          <div className="rounded-md border border-border-subtle bg-surface px-4 py-10 text-center">
            <p className="text-sm text-text-secondary">Task-urile nu au putut fi încărcate.</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void load();
              }}
              className="mt-3 rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-raised hover:text-text-primary"
            >
              Reîncearcă
            </button>
          </div>
        ) : loading && tasks.length === 0 ? (
          <p className="py-10 text-center text-sm text-text-muted">Se încarcă…</p>
        ) : nothingToShow && !hasFilters && !includeDone ? (
          <div className="rounded-md border border-border-subtle bg-surface px-4 py-12 text-center">
            <i className="ti ti-list-check text-3xl text-text-disabled" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-text-primary">
              {scope === 'mine' ? 'Nu ai niciun task deschis.' : 'Niciun task deschis.'}
            </p>
            <p className="mt-1 text-sm text-text-muted">
              Creează unul pentru tine sau pentru un coleg.
            </p>
          </div>
        ) : nothingToShow ? (
          <p className="rounded-md border border-border-subtle bg-surface px-4 py-10 text-center text-sm text-text-muted">
            Niciun task nu se potrivește cu filtrele alese.
          </p>
        ) : (
          <TaskList
            tasks={visibleTasks}
            showDone={includeDone}
            pendingTaskId={pendingTaskId}
            onOpen={(task) => setParams({ task: task.id })}
            onStatusChange={(task, nextStatus) => void handleStatusChange(task, nextStatus)}
            onDelete={(task) => void handleDelete(task)}
          />
        )}
        {doneListCut && !failed ? (
          <p className="mt-3 text-xs text-text-muted">
            Sunt afișate doar ultimele {TASK_DONE_LIST_LIMIT} task-uri finalizate. Alege un proiect
            ca să le vezi pe cele mai vechi ale lui.
          </p>
        ) : null}
      </div>

      {creating && (
        <TaskFormPanel
          lookups={lookups}
          initialProjectId={projectId}
          onClose={() => setParams({ new: null })}
          onCreated={() => {
            setParams({ new: null });
            void load();
          }}
        />
      )}

      {openTaskId && !creating && (
        <TaskDetailPanel
          taskId={openTaskId}
          lookups={lookups}
          onClose={() => setParams({ task: null })}
          onChanged={() => void load()}
        />
      )}
    </div>
  );
}

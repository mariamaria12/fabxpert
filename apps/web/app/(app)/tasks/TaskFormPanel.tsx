'use client';

import {
  createTask,
  parseWorkDateString,
  TASK_DESCRIPTION_MAX_LENGTH,
  TASK_TITLE_MAX_LENGTH,
  todayDateInputValue,
  workDateToDayKey,
  type TaskPriority,
} from '@fabxpert/shared';
import { useState, type FormEvent } from 'react';
import { DateField } from '@/components/DateField';
import { FORM_LABEL_CLASS } from '@/components/formFieldStyles';
import { useBusinessAutofillProps } from '@/components/inputAutofill';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import { TextField } from '@/components/TextField';
import { useAuthUser } from '@/context/AuthUserContext';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import {
  TimesheetProjectField,
  useTimesheetProjectLists,
} from '../timesheets/TimesheetProjectField';
import { TASK_PRIORITY_TONE, TaskPriorityPicker } from './taskDisplay';
import { TaskRecipientsField } from './TaskRecipientsField';
import type { TaskLookups } from './useTaskLookups';

interface TaskFormPanelProps {
  lookups: TaskLookups;
  /** Preselected when the task is started from a project. */
  initialProjectId?: string | null;
  onClose: () => void;
  onCreated: () => void;
}

/** Deadlines one tap away, as days from today. */
const DUE_SHORTCUTS = [
  { label: 'Azi', days: 0 },
  { label: 'Mâine', days: 1 },
  { label: 'Peste o săptămână', days: 7 },
];

function dayFromToday(days: number): string {
  const date = parseWorkDateString(todayDateInputValue());
  date.setDate(date.getDate() + days);
  return workDateToDayKey(date);
}

/**
 * Creates a task the way an email is written: who it goes to, a subject, the
 * message, send. The subject is the task's title and the message its
 * description; each recipient gets a task of their own. Only the subject, the
 * project and one recipient are required.
 */
export function TaskFormPanel({
  lookups,
  initialProjectId,
  onClose,
  onCreated,
}: TaskFormPanelProps) {
  const { showToast } = useToast();
  const authUser = useAuthUser();
  const businessAutofill = useBusinessAutofillProps();
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState(initialProjectId ?? '');
  // Same picker as a pontaj: the projects in execution up front, the rest on demand.
  const projectLists = useTimesheetProjectLists(true);
  // A task started from a project keeps that project, in execution or not.
  const initialProject = initialProjectId
    ? lookups.projects.find((project) => project.id === initialProjectId)
    : undefined;
  const [assigneeUserIds, setAssigneeUserIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('NORMAL');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<{ title?: string; project?: string; assignee?: string }>({});
  const [saving, setSaving] = useState(false);

  const tone = TASK_PRIORITY_TONE[priority];

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const nextErrors = {
      title: title.trim() ? undefined : 'Scrie subiectul.',
      project: projectId ? undefined : 'Alege proiectul.',
      assignee: assigneeUserIds.length > 0 ? undefined : 'Alege cui îi trimiți task-ul.',
    };
    setErrors(nextErrors);
    if (nextErrors.title || nextErrors.project || nextErrors.assignee) {
      return;
    }

    setSaving(true);
    const sentUserIds: string[] = [];
    try {
      for (const assigneeUserId of assigneeUserIds) {
        await createTask({
          title: title.trim(),
          projectId,
          assigneeUserId,
          dueDate: dueDate || null,
          priority,
          description: description.trim() || undefined,
        });
        sentUserIds.push(assigneeUserId);
      }
      showToast(
        sentUserIds.length === 1
          ? 'Task-ul a fost trimis.'
          : `Task-ul a fost trimis către ${sentUserIds.length} persoane.`,
        'success',
      );
      onCreated();
    } catch (caught) {
      // Whoever already got the task leaves the line, so trying again does not send it twice.
      setAssigneeUserIds((current) => current.filter((id) => !sentUserIds.includes(id)));
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setSaving(false);
    }
  }

  const footer = (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onClose}
        disabled={saving}
        className="rounded-full px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:opacity-50"
      >
        Renunță
      </button>
      <button
        type="submit"
        form="task-form"
        disabled={saving}
        className="flex flex-1 items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-medium text-accent-contrast transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? 'Se trimite…' : 'Trimite'}
        <i className="ti ti-send text-base" aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <SlideOverPanel open title="Task nou" onClose={onClose} disableClose={saving} footer={footer}>
      <form id="task-form" onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <TaskRecipientsField
          users={lookups.assignees}
          value={assigneeUserIds}
          currentUserId={authUser?.id}
          loading={lookups.loading}
          disabled={saving}
          error={errors.assignee}
          onChange={(next) => {
            setAssigneeUserIds(next);
            setErrors((current) => ({ ...current, assignee: undefined }));
          }}
        />

        <TextField
          id="taskTitle"
          label="Subiect"
          required
          maxLength={TASK_TITLE_MAX_LENGTH}
          value={title}
          placeholder="Ce e de făcut?"
          error={errors.title}
          disabled={saving}
          onChange={(next) => {
            setTitle(next);
            setErrors((current) => ({ ...current, title: undefined }));
          }}
        />

        {/* The bubble wears the color of the priority picked below. */}
        <div
          className={`rounded-2xl rounded-br-md border px-4 py-3 transition-colors focus-within:ring-2 focus-within:ring-accent/25 ${tone.surface}`}
        >
          <textarea
            id="taskDescription"
            aria-label="Mesaj"
            rows={4}
            maxLength={TASK_DESCRIPTION_MAX_LENGTH}
            value={description}
            placeholder="Scrie mesajul…"
            disabled={saving}
            onChange={(event) => setDescription(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.currentTarget.form?.requestSubmit();
              }
            }}
            className="block w-full resize-none bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
            {...businessAutofill}
          />
        </div>

        <div>
          <span className={FORM_LABEL_CLASS}>Cât de urgent e?</span>
          <TaskPriorityPicker value={priority} disabled={saving} onChange={setPriority} />
        </div>

        <TimesheetProjectField
          id="taskProject"
          value={projectId}
          lists={projectLists}
          savedProject={initialProject}
          error={errors.project}
          disabled={saving}
          allowEmpty
          onChange={(next) => {
            setProjectId(next);
            setErrors((current) => ({ ...current, project: undefined }));
          }}
        />

        <div className="flex flex-col gap-2">
          <DateField
            id="taskDueDate"
            label="Până când?"
            value={dueDate}
            disabled={saving}
            onChange={setDueDate}
          />
          <div className="flex flex-wrap gap-1.5">
            {DUE_SHORTCUTS.map((shortcut) => {
              const day = dayFromToday(shortcut.days);
              const selected = dueDate === day;
              return (
                <button
                  key={shortcut.label}
                  type="button"
                  aria-pressed={selected}
                  disabled={saving}
                  onClick={() => setDueDate(selected ? '' : day)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    selected
                      ? 'border-accent bg-[var(--color-accent-tint-strong)] text-text-primary'
                      : 'border-border text-text-secondary hover:border-text-muted/40 hover:text-text-primary'
                  }`}
                >
                  {shortcut.label}
                </button>
              );
            })}
          </div>
        </div>
      </form>
    </SlideOverPanel>
  );
}

'use client';

import {
  createTask,
  getTaskPriorityLabel,
  TASK_DESCRIPTION_MAX_LENGTH,
  TASK_PRIORITY_VALUES,
  TASK_TITLE_MAX_LENGTH,
  type TaskDetailDto,
  type TaskPriority,
} from '@fabxpert/shared';
import { useState, type FormEvent } from 'react';
import { DateField } from '@/components/DateField';
import { FORM_FIELD_CLASS, FORM_LABEL_CLASS } from '@/components/formFieldStyles';
import { useBusinessAutofillProps } from '@/components/inputAutofill';
import { SearchableSelect } from '@/components/SearchableSelect';
import { SelectField } from '@/components/SelectField';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import { TextField } from '@/components/TextField';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import {
  TimesheetProjectField,
  useTimesheetProjectLists,
} from '../timesheets/TimesheetProjectField';
import type { TaskLookups } from './useTaskLookups';

interface TaskFormPanelProps {
  lookups: TaskLookups;
  /** Preselected when the task is started from a project. */
  initialProjectId?: string | null;
  onClose: () => void;
  onCreated: (task: TaskDetailDto) => void;
}

const PRIORITY_OPTIONS = TASK_PRIORITY_VALUES.map((priority) => ({
  id: priority,
  label: getTaskPriorityLabel(priority),
}));

/** Creates a task. Only the title, the project and the assignee are required. */
export function TaskFormPanel({
  lookups,
  initialProjectId,
  onClose,
  onCreated,
}: TaskFormPanelProps) {
  const { showToast } = useToast();
  const businessAutofill = useBusinessAutofillProps();
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState(initialProjectId ?? '');
  // Same picker as a pontaj: the projects in execution up front, the rest on demand.
  const projectLists = useTimesheetProjectLists(true);
  // A task started from a project keeps that project, in execution or not.
  const initialProject = initialProjectId
    ? lookups.projects.find((project) => project.id === initialProjectId)
    : undefined;
  const [assigneeUserId, setAssigneeUserId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('NORMAL');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<{ title?: string; project?: string; assignee?: string }>({});
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const nextErrors = {
      title: title.trim() ? undefined : 'Titlul este obligatoriu.',
      project: projectId ? undefined : 'Alege proiectul.',
      assignee: assigneeUserId ? undefined : 'Alege responsabilul.',
    };
    setErrors(nextErrors);
    if (nextErrors.title || nextErrors.project || nextErrors.assignee) {
      return;
    }

    setSaving(true);
    try {
      const task = await createTask({
        title: title.trim(),
        projectId,
        assigneeUserId: assigneeUserId!,
        dueDate: dueDate || null,
        priority,
        description: description.trim() || undefined,
      });
      showToast('Task-ul a fost creat.', 'success');
      onCreated(task);
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setSaving(false);
    }
  }

  const footer = (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={onClose}
        disabled={saving}
        className="flex-1 rounded-md border border-border px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:opacity-50"
      >
        Anulează
      </button>
      <button
        type="submit"
        form="task-form"
        disabled={saving}
        className="flex-1 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-contrast disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? 'Se creează…' : 'Creează task'}
      </button>
    </div>
  );

  return (
    <SlideOverPanel open title="Task nou" onClose={onClose} disableClose={saving} footer={footer}>
      <form id="task-form" onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <TextField
          id="taskTitle"
          label="Titlu"
          required
          autoFocus
          maxLength={TASK_TITLE_MAX_LENGTH}
          value={title}
          error={errors.title}
          disabled={saving}
          onChange={(next) => {
            setTitle(next);
            setErrors((current) => ({ ...current, title: undefined }));
          }}
        />

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

        <SearchableSelect
          id="taskAssignee"
          label="Responsabil"
          required
          value={assigneeUserId}
          options={lookups.assigneeOptions}
          placeholder={lookups.loading ? 'Se încarcă…' : 'Alege responsabilul…'}
          error={errors.assignee}
          disabled={saving}
          onChange={(next) => {
            setAssigneeUserId(next);
            setErrors((current) => ({ ...current, assignee: undefined }));
          }}
        />

        <div className="grid grid-cols-2 gap-3">
          <DateField
            id="taskDueDate"
            label="Termen"
            value={dueDate}
            disabled={saving}
            onChange={setDueDate}
          />
          <SelectField
            id="taskPriority"
            label="Prioritate"
            value={priority}
            options={PRIORITY_OPTIONS}
            disabled={saving}
            onChange={(next) => setPriority(next as TaskPriority)}
          />
        </div>

        <div>
          <label htmlFor="taskDescription" className={FORM_LABEL_CLASS}>
            Descriere
          </label>
          <textarea
            id="taskDescription"
            rows={4}
            maxLength={TASK_DESCRIPTION_MAX_LENGTH}
            value={description}
            disabled={saving}
            onChange={(event) => setDescription(event.target.value)}
            className={`${FORM_FIELD_CLASS} resize-none`}
            {...businessAutofill}
          />
        </div>
      </form>
    </SlideOverPanel>
  );
}

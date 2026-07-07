'use client';

import {
  ApiError,
  createTimesheet,
  createTimesheetSchema,
  deleteTimesheet,
  listActivities,
  listPersons,
  listProjects,
  updateTimesheet,
  updateTimesheetSchema,
  type ActivityDto,
  type PersonDto,
  type ProjectDto,
  type TimesheetDto,
} from '@fabxpert/shared';
import { useEffect, useState, type FormEvent } from 'react';
import {
  combineDateAndTime,
  isoToDateInput,
  isoToTimeInput,
} from './timesheetFormat';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';

interface TimesheetFormValues {
  personId: string;
  projectId: string;
  activityId: string;
  date: string;
  startTime: string;
  endTime: string;
  notes: string;
}

const EMPTY_FORM: TimesheetFormValues = {
  personId: '',
  projectId: '',
  activityId: '',
  date: '',
  startTime: '',
  endTime: '',
  notes: '',
};

function timesheetToFormValues(timesheet: TimesheetDto): TimesheetFormValues {
  return {
    personId: timesheet.personId,
    projectId: timesheet.projectId,
    activityId: timesheet.activityId ?? '',
    date: isoToDateInput(timesheet.startTime),
    startTime: isoToTimeInput(timesheet.startTime),
    endTime: timesheet.endTime ? isoToTimeInput(timesheet.endTime) : '',
    notes: timesheet.notes ?? '',
  };
}

function buildPayload(values: TimesheetFormValues) {
  const startTime = combineDateAndTime(values.date, values.startTime);
  const endTime = values.endTime ? combineDateAndTime(values.date, values.endTime) : undefined;

  return {
    personId: values.personId,
    projectId: values.projectId,
    activityId: values.activityId || undefined,
    startTime: startTime ?? new Date(),
    endTime,
    notes: values.notes.trim() || undefined,
  };
}

function mapZodFieldErrors(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined> };
}) {
  const flat = error.flatten().fieldErrors;
  const mapped: Partial<Record<keyof TimesheetFormValues, string>> = {};

  if (flat.personId?.[0]) {
    mapped.personId = 'Persoana este obligatorie.';
  }
  if (flat.projectId?.[0]) {
    mapped.projectId = 'Proiectul este obligatoriu.';
  }
  if (flat.startTime?.[0]) {
    mapped.startTime = 'Ora de start este obligatorie.';
  }
  if (flat.endTime?.[0]) {
    mapped.endTime = 'Ora de stop trebuie să fie după ora de start.';
  }

  return mapped;
}

const inputClassName =
  'w-full rounded-md border border-border bg-surface-raised px-3 py-[10px] text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

interface FormFieldProps {
  id: keyof TimesheetFormValues;
  label: string;
  value: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  type?: 'text' | 'date' | 'time';
  onChange: (value: string) => void;
}

function FormField({
  id,
  label,
  value,
  error,
  disabled,
  required,
  type = 'text',
  onChange,
}: FormFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs text-text-secondary">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={inputClassName}
      />
      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

interface SelectFieldProps {
  id: keyof TimesheetFormValues;
  label: string;
  value: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder: string;
  options: { id: string; label: string }[];
  onChange: (value: string) => void;
}

function SelectField({
  id,
  label,
  value,
  error,
  disabled,
  required,
  placeholder,
  options,
  onChange,
}: SelectFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs text-text-secondary">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={inputClassName}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export interface TimesheetFormPanelProps {
  open: boolean;
  mode: 'create' | 'edit';
  timesheet: TimesheetDto | null;
  onClose: () => void;
  onSaved: () => void;
}

const LOOKUP_PAGE_SIZE = 500;

export function TimesheetFormPanel({
  open,
  mode,
  timesheet,
  onClose,
  onSaved,
}: TimesheetFormPanelProps) {
  const { showToast } = useToast();
  const [values, setValues] = useState<TimesheetFormValues>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof TimesheetFormValues, string>>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [persons, setPersons] = useState<PersonDto[]>([]);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [activities, setActivities] = useState<ActivityDto[]>([]);

  const isBusy = isSubmitting || isDeleting;
  const title = mode === 'create' ? 'Pontaj nou' : 'Editează pontajul';

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    Promise.all([
      listPersons(1, LOOKUP_PAGE_SIZE),
      listProjects(1, LOOKUP_PAGE_SIZE),
      listActivities(),
    ])
      .then(([personsResponse, projectsResponse, activitiesResponse]) => {
        if (!cancelled) {
          setPersons(personsResponse.data);
          setProjects(projectsResponse.data);
          setActivities(activitiesResponse);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPersons([]);
          setProjects([]);
          setActivities([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setConfirmDelete(false);
    setIsSubmitting(false);
    setIsDeleting(false);
    setValues(mode === 'edit' && timesheet ? timesheetToFormValues(timesheet) : EMPTY_FORM);
  }, [open, mode, timesheet]);

  function updateField(field: keyof TimesheetFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }
      const next = { ...current };
      delete next[field];
      return next;
    });
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy) {
      return;
    }

    setFormError(null);
    setFieldErrors({});

    if (!values.date || !values.startTime) {
      const nextErrors: Partial<Record<keyof TimesheetFormValues, string>> = {};
      if (!values.date) {
        nextErrors.date = 'Data este obligatorie.';
      }
      if (!values.startTime) {
        nextErrors.startTime = 'Ora de start este obligatorie.';
      }
      setFieldErrors(nextErrors);
      return;
    }

    const payload = buildPayload(values);

    if (mode === 'create') {
      const parsed = createTimesheetSchema.safeParse(payload);
      if (!parsed.success) {
        setFieldErrors(mapZodFieldErrors(parsed.error));
        return;
      }

      setIsSubmitting(true);
      try {
        await createTimesheet(parsed.data);
        showToast('Pontaj adăugat', 'success');
        onSaved();
        onClose();
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 400) {
          setFormError(caught.message);
        } else {
          showToast(apiErrorToastMessage(caught), 'error');
        }
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!timesheet) {
      return;
    }

    const parsed = updateTimesheetSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(mapZodFieldErrors(parsed.error));
      return;
    }

    setIsSubmitting(true);
    try {
      await updateTimesheet(timesheet.id, parsed.data);
      showToast('Pontaj actualizat', 'success');
      onSaved();
      onClose();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 400) {
        setFormError(caught.message);
      } else {
        showToast(apiErrorToastMessage(caught), 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!timesheet || isBusy) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteTimesheet(timesheet.id);
      showToast('Pontaj șters', 'success');
      onSaved();
      onClose();
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  }

  const personOptions = persons.map((person) => ({
    id: person.id,
    label: `${person.firstName} ${person.lastName}`,
  }));

  const projectOptions = projects.map((project) => ({
    id: project.id,
    label: project.code ? `${project.name} · ${project.code}` : project.name,
  }));

  const activityOptions = activities.map((activity) => ({
    id: activity.id,
    label: activity.name,
  }));

  const footer = confirmDelete ? (
    <div role="alertdialog" aria-labelledby="timesheet-delete-title">
      <p id="timesheet-delete-title" className="text-sm text-text-secondary">
        Sigur ștergi acest pontaj?
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={isDeleting}
          onClick={() => void handleDelete()}
          className="flex-1 rounded-md bg-[var(--color-timer-stop)] px-4 py-2.5 text-sm font-medium text-[var(--color-timer-stop-text)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isDeleting ? 'Se șterge…' : 'Șterge'}
        </button>
        <button
          type="button"
          disabled={isDeleting}
          onClick={() => setConfirmDelete(false)}
          className="flex-1 rounded-md border border-border px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Anulează
        </button>
      </div>
    </div>
  ) : (
    <div className="flex gap-2">
      <button
        type="submit"
        form="timesheet-form"
        disabled={isBusy}
        className="flex-1 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-contrast disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? 'Se salvează…' : mode === 'create' ? 'Adaugă' : 'Salvează'}
      </button>
      <button
        type="button"
        disabled={isBusy}
        onClick={onClose}
        className="rounded-md border border-border px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        Anulează
      </button>
    </div>
  );

  return (
    <SlideOverPanel
      open={open}
      title={title}
      onClose={onClose}
      disableClose={isBusy}
      footer={footer}
    >
      <form
        id="timesheet-form"
        onSubmit={(event) => void handleSubmit(event)}
        className="flex flex-col gap-4"
      >
        <SelectField
          id="personId"
          label="Persoană"
          value={values.personId}
          error={fieldErrors.personId}
          disabled={isBusy}
          required
          placeholder="Selectează persoana"
          options={personOptions}
          onChange={(value) => updateField('personId', value)}
        />

        <SelectField
          id="projectId"
          label="Proiect"
          value={values.projectId}
          error={fieldErrors.projectId}
          disabled={isBusy}
          required
          placeholder="Selectează proiectul"
          options={projectOptions}
          onChange={(value) => updateField('projectId', value)}
        />

        <SelectField
          id="activityId"
          label="Activitate"
          value={values.activityId}
          disabled={isBusy}
          placeholder="Fără activitate"
          options={activityOptions}
          onChange={(value) => updateField('activityId', value)}
        />

        <FormField
          id="date"
          label="Data"
          type="date"
          value={values.date}
          error={fieldErrors.date}
          disabled={isBusy}
          required
          onChange={(value) => updateField('date', value)}
        />

        <FormField
          id="startTime"
          label="Ora start"
          type="time"
          value={values.startTime}
          error={fieldErrors.startTime}
          disabled={isBusy}
          required
          onChange={(value) => updateField('startTime', value)}
        />

        <FormField
          id="endTime"
          label="Ora stop"
          type="time"
          value={values.endTime}
          error={fieldErrors.endTime}
          disabled={isBusy}
          onChange={(value) => updateField('endTime', value)}
        />

        <div>
          <label htmlFor="notes" className="mb-1.5 block text-xs text-text-secondary">
            Notițe
          </label>
          <textarea
            id="notes"
            rows={3}
            value={values.notes}
            disabled={isBusy}
            onChange={(event) => updateField('notes', event.target.value)}
            className={inputClassName}
          />
        </div>

        {formError && (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        )}

        {mode === 'edit' && !confirmDelete && (
          <div className="mt-2 border-t border-border-subtle pt-4">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-2 text-sm text-danger transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <i className="ti ti-trash text-base" aria-hidden="true" />
              <span>Șterge pontajul</span>
            </button>
          </div>
        )}
      </form>
    </SlideOverPanel>
  );
}

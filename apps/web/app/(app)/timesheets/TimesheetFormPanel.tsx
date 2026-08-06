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
  todayDateInputValue,
  parseDateDisplay,
  type ActivityDto,
  type PersonDto,
  type ProjectDto,
  type TimesheetDto,
} from '@fabxpert/shared';
import { useEffect, useState, type FormEvent } from 'react';
import {
  isoToDateInput,
  durationMinutesToHoursInput,
  parseDurationMinutesInput,
} from './timesheetFormat';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import { DateField } from '@/components/DateField';
import { SelectField } from '@/components/SelectField';
import { TextField } from '@/components/TextField';
import { useBusinessAutofillProps } from '@/components/inputAutofill';
import { FORM_FIELD_CLASS } from '@/components/formFieldStyles';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';

interface TimesheetFormValues {
  personId: string;
  projectId: string;
  activityId: string;
  workDate: string;
  duration: string;
  notes: string;
}

/** Mirrors what parseDurationMinutesInput accepts. */
const DURATION_PLACEHOLDER = 'ex. 9h, 1h30 sau 45m';

const EMPTY_FORM: TimesheetFormValues = {
  personId: '',
  projectId: '',
  activityId: '',
  workDate: '',
  duration: '',
  notes: '',
};

/** Values prefilled when the panel is opened in create mode from another screen. */
export interface TimesheetCreateDefaults {
  personId?: string;
  workDate?: string;
  duration?: string;
}

function createEmptyForm(defaults?: TimesheetCreateDefaults): TimesheetFormValues {
  return {
    ...EMPTY_FORM,
    personId: defaults?.personId ?? EMPTY_FORM.personId,
    duration: defaults?.duration ?? EMPTY_FORM.duration,
    workDate: defaults?.workDate ?? todayDateInputValue(),
  };
}

function timesheetToFormValues(timesheet: TimesheetDto): TimesheetFormValues {
  return {
    personId: timesheet.personId,
    projectId: timesheet.projectId,
    activityId: timesheet.activityId ?? '',
    workDate: isoToDateInput(timesheet.workDate),
    duration: durationMinutesToHoursInput(timesheet.durationMinutes),
    notes: timesheet.notes ?? '',
  };
}

function buildPayload(values: TimesheetFormValues) {
  const durationMinutes = parseDurationMinutesInput(values.duration);

  return {
    personId: values.personId,
    projectId: values.projectId,
    activityId: values.activityId || undefined,
    workDate: values.workDate || undefined,
    durationMinutes: durationMinutes ?? 0,
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
  if (flat.activityId?.[0]) {
    mapped.activityId = 'Activitatea este obligatorie.';
  }
  if (flat.durationMinutes?.[0]) {
    mapped.duration = 'Durata trebuie să fie un număr pozitiv de minute.';
  }

  return mapped;
}

export interface TimesheetFormPanelProps {
  open: boolean;
  mode: 'create' | 'edit';
  timesheet: TimesheetDto | null;
  /** Only used in create mode; memoize it so the form isn't reset on every render. */
  createDefaults?: TimesheetCreateDefaults;
  onClose: () => void;
  onSaved: (updated?: TimesheetDto) => void;
}

const LOOKUP_PAGE_SIZE = 500;

export function TimesheetFormPanel({
  open,
  mode,
  timesheet,
  createDefaults,
  onClose,
  onSaved,
}: TimesheetFormPanelProps) {
  const { showToast } = useToast();
  const businessAutofill = useBusinessAutofillProps();
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
      listPersons({ page: 1, pageSize: LOOKUP_PAGE_SIZE }),
      listProjects({ page: 1, pageSize: LOOKUP_PAGE_SIZE, compact: true }),
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
    setValues(
      mode === 'edit' && timesheet
        ? timesheetToFormValues(timesheet)
        : createEmptyForm(createDefaults),
    );
  }, [open, mode, timesheet, createDefaults]);

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

    // Everything except the notes is mandatory.
    const nextErrors: Partial<Record<keyof TimesheetFormValues, string>> = {};
    if (!values.personId) {
      nextErrors.personId = 'Persoana este obligatorie.';
    }
    if (!values.projectId) {
      nextErrors.projectId = 'Proiectul este obligatoriu.';
    }
    if (!values.activityId) {
      nextErrors.activityId = 'Activitatea este obligatorie.';
    }
    if (!values.workDate || !parseDateDisplay(values.workDate)) {
      nextErrors.workDate = 'Introdu data în format dd/mm/yyyy.';
    }
    if (!values.duration) {
      nextErrors.duration = 'Durata este obligatorie.';
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    const durationMinutes = parseDurationMinutesInput(values.duration);
    if (durationMinutes === null || durationMinutes <= 0) {
      setFieldErrors({ duration: `Introdu o durată validă (${DURATION_PLACEHOLDER}).` });
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
      const saved = await updateTimesheet(timesheet.id, parsed.data);
      showToast('Pontaj actualizat', 'success');
      onSaved(saved);
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
    label: project.company.name
      ? `${project.code || project.name} - ${project.company.name}`
      : project.code || project.name,
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
          allowEmpty
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
          allowEmpty
          placeholder="Selectează proiectul"
          options={projectOptions}
          onChange={(value) => updateField('projectId', value)}
        />

        <SelectField
          id="activityId"
          label="Activitate"
          value={values.activityId}
          error={fieldErrors.activityId}
          disabled={isBusy}
          required
          allowEmpty
          placeholder="Selectează activitatea"
          options={activityOptions}
          onChange={(value) => updateField('activityId', value)}
        />

        <DateField
          id="workDate"
          label="Data lucrată"
          value={values.workDate}
          error={fieldErrors.workDate}
          disabled={isBusy}
          required
          onChange={(value) => updateField('workDate', value)}
        />

        <TextField
          id="duration"
          label="Durată"
          value={values.duration}
          error={fieldErrors.duration}
          disabled={isBusy}
          required
          placeholder={DURATION_PLACEHOLDER}
          onChange={(value) => updateField('duration', value)}
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
            className={`${FORM_FIELD_CLASS} resize-none`}
            {...businessAutofill}
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

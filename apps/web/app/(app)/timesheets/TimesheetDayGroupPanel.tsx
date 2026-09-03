'use client';

import {
  deleteTimesheet,
  listActivities,
  listProjects,
  updateTimesheet,
  type ActivityDto,
  type ProjectDto,
  type TimesheetAssemblyInput,
  type TimesheetDayGroupDto,
  type TimesheetDto,
  type UpdateTimesheetInput,
} from '@fabxpert/shared';
import { useEffect, useState, type FormEvent } from 'react';
import {
  durationMinutesToHoursInput,
  isoToDateInput,
  parseDurationMinutesInput,
} from './timesheetFormat';
import { TimesheetAssemblyFields } from './TimesheetAssemblyFields';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import { DateField } from '@/components/DateField';
import { SelectField, type SelectFieldOption } from '@/components/SelectField';
import { TextField } from '@/components/TextField';
import { FORM_FIELD_CLASS, FORM_LABEL_CLASS } from '@/components/formFieldStyles';
import { useBusinessAutofillProps } from '@/components/inputAutofill';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';

/** Mirrors what parseDurationMinutesInput accepts. */
const DURATION_PLACEHOLDER = 'ex. 9h, 1h30 sau 45m';
const DURATION_ERROR_MESSAGE = 'Durata trebuie să fie de forma 9h, 1h30 sau 45m.';
const NO_ACTIVITY_LABEL = 'Fără activitate';
const LOOKUP_PAGE_SIZE = 500;

/** The editable fields of one entry. */
interface EntryDraft {
  projectId: string;
  activityId: string;
  duration: string;
  notes: string;
  assemblies: TimesheetAssemblyInput[];
}

function entryToDraft(entry: TimesheetDto): EntryDraft {
  return {
    projectId: entry.projectId,
    activityId: entry.activityId ?? '',
    duration: durationMinutesToHoursInput(entry.durationMinutes),
    notes: entry.notes ?? '',
    assemblies: entry.assemblies.map((link) => ({
      assemblyId: link.assemblyId,
      quantityDone: link.quantityDone,
    })),
  };
}

/** Same marks, same pieces, same order — nothing to send. */
function sameAssemblies(a: TimesheetAssemblyInput[], b: TimesheetAssemblyInput[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const byId = new Map(b.map((link) => [link.assemblyId, link.quantityDone]));

  return a.every((link) => byId.get(link.assemblyId) === link.quantityDone);
}

function draftsFromEntries(entries: TimesheetDto[]): Record<string, EntryDraft> {
  return Object.fromEntries(entries.map((entry) => [entry.id, entryToDraft(entry)]));
}

function projectOptionLabel(project: {
  code: string;
  name: string;
  denumireLucrare: string | null;
  company: { name: string };
}): string {
  const head = project.code || project.name;
  return [head, project.denumireLucrare, project.company.name].filter(Boolean).join(' · ');
}

/**
 * The entry's own project and activity may be missing from the lookups (older
 * projects fall outside the first page), so they are added back — otherwise the
 * select would look empty on a pontaj nobody touched.
 */
function withEntryOptions(
  options: SelectFieldOption[],
  entryOptions: SelectFieldOption[],
): SelectFieldOption[] {
  const known = new Set(options.map((option) => option.id));
  const missing = entryOptions.filter(
    (option) => option.id !== '' && !known.has(option.id),
  );
  return missing.length > 0 ? [...options, ...missing] : options;
}

export interface TimesheetDayGroupPanelProps {
  open: boolean;
  group: TimesheetDayGroupDto;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Edits one person-day: the date moves every entry of that day, and each pontaj
 * keeps its own project, activity, duration and notes.
 */
export function TimesheetDayGroupPanel({
  open,
  group,
  onClose,
  onSaved,
}: TimesheetDayGroupPanelProps) {
  const { showToast } = useToast();
  const businessAutofill = useBusinessAutofillProps();
  // Deleting an entry drops it from the list without closing the panel, so the
  // day's entries live in state instead of being read straight off the prop.
  const [entries, setEntries] = useState<TimesheetDto[]>(group.entries);
  const [workDate, setWorkDate] = useState(() => isoToDateInput(group.workDate));
  const [drafts, setDrafts] = useState<Record<string, EntryDraft>>(() =>
    draftsFromEntries(group.entries),
  );
  const [durationErrors, setDurationErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [activities, setActivities] = useState<ActivityDto[]>([]);

  useEffect(() => {
    setEntries(group.entries);
    setWorkDate(isoToDateInput(group.workDate));
    setDrafts(draftsFromEntries(group.entries));
    setDurationErrors({});
    setFormError(null);
    setConfirmDeleteId(null);
  }, [group]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    Promise.all([
      listProjects({ page: 1, pageSize: LOOKUP_PAGE_SIZE, compact: true }),
      listActivities(),
    ])
      .then(([projectsResponse, activitiesResponse]) => {
        if (!cancelled) {
          setProjects(projectsResponse.data);
          setActivities(activitiesResponse);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProjects([]);
          setActivities([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const personName = `${group.person.firstName} ${group.person.lastName}`;
  const dateChanged = workDate !== isoToDateInput(group.workDate);
  const isBusy = isSubmitting || deletingId !== null;

  const projectOptions = withEntryOptions(
    projects.map((project) => ({ id: project.id, label: projectOptionLabel(project) })),
    entries.map((entry) => ({
      id: entry.projectId,
      label: projectOptionLabel(entry.project),
    })),
  );

  const activityOptions = withEntryOptions(
    activities.map((activity) => ({ id: activity.id, label: activity.name })),
    entries.map((entry) => ({
      id: entry.activityId ?? '',
      label: entry.activity?.name ?? NO_ACTIVITY_LABEL,
    })),
  );

  function tracksAssemblies(activityId: string): boolean {
    return activities.some((activity) => activity.id === activityId && activity.tracksAssemblies);
  }

  function updateAssemblies(entryId: string, assemblies: TimesheetAssemblyInput[]) {
    setDrafts((current) => ({
      ...current,
      [entryId]: { ...current[entryId], assemblies },
    }));
    setFormError(null);
  }

  function updateDraft(
    entryId: string,
    field: 'projectId' | 'activityId' | 'duration' | 'notes',
    value: string,
  ) {
    setDrafts((current) => {
      const draft = current[entryId];
      const next = { ...draft, [field]: value };
      // A mark belongs to one project's drawing and to the activity it was
      // reported on, so moving either one empties the list.
      const movedProject = field === 'projectId' && value !== draft.projectId;
      const leftAssemblyActivity = field === 'activityId' && !tracksAssemblies(value);

      return {
        ...current,
        [entryId]: movedProject || leftAssemblyActivity ? { ...next, assemblies: [] } : next,
      };
    });
    if (field === 'duration') {
      setDurationErrors((current) => {
        if (!current[entryId]) {
          return current;
        }
        const next = { ...current };
        delete next[entryId];
        return next;
      });
    }
    setFormError(null);
  }

  /** Only the fields that actually changed are sent. */
  function buildEntryPayload(entry: TimesheetDto, minutes: number): UpdateTimesheetInput {
    const draft = drafts[entry.id];
    const notes = draft.notes.trim();
    const savedAssemblies = entry.assemblies.map((link) => ({
      assemblyId: link.assemblyId,
      quantityDone: link.quantityDone,
    }));
    // An activity that no longer tracks assemblies clears them; the server
    // drops them on a project change on its own.
    const nextAssemblies = tracksAssemblies(draft.activityId) ? draft.assemblies : [];
    const assembliesChanged =
      draft.projectId === entry.projectId && !sameAssemblies(nextAssemblies, savedAssemblies);

    return {
      ...(dateChanged ? { workDate } : {}),
      ...(minutes !== entry.durationMinutes ? { durationMinutes: minutes } : {}),
      ...(draft.projectId !== entry.projectId ? { projectId: draft.projectId } : {}),
      ...(draft.activityId && draft.activityId !== entry.activityId
        ? { activityId: draft.activityId }
        : {}),
      ...(notes !== (entry.notes ?? '') ? { notes } : {}),
      ...(assembliesChanged ? { assemblies: nextAssemblies } : {}),
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setFormError(null);

    if (!workDate) {
      setFormError('Data este obligatorie.');
      return;
    }

    const errors: Record<string, string> = {};
    const parsedDurations = new Map<string, number>();

    for (const entry of entries) {
      const minutes = parseDurationMinutesInput(drafts[entry.id].duration);
      if (minutes === null) {
        errors[entry.id] = DURATION_ERROR_MESSAGE;
        continue;
      }
      parsedDurations.set(entry.id, minutes);
    }

    if (Object.keys(errors).length > 0) {
      setDurationErrors(errors);
      return;
    }

    const updates = entries.flatMap((entry) => {
      const payload = buildEntryPayload(entry, parsedDurations.get(entry.id)!);
      return Object.keys(payload).length > 0 ? [{ id: entry.id, payload }] : [];
    });

    if (updates.length === 0) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    try {
      // Independent entries — sending them one after another would make the
      // save take as long as the sum of the round trips.
      await Promise.all(updates.map((update) => updateTimesheet(update.id, update.payload)));
      showToast('Pontaje actualizate', 'success');
      onSaved();
      onClose();
    } catch (caught) {
      setFormError(apiErrorToastMessage(caught));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteEntry(entryId: string) {
    if (isBusy) {
      return;
    }

    setDeletingId(entryId);
    setFormError(null);
    try {
      await deleteTimesheet(entryId);
      showToast('Pontaj șters', 'success');
      onSaved();

      const remaining = entries.filter((entry) => entry.id !== entryId);
      setEntries(remaining);
      setDrafts((current) => {
        const next = { ...current };
        delete next[entryId];
        return next;
      });
      setDurationErrors((current) => {
        const next = { ...current };
        delete next[entryId];
        return next;
      });
      setConfirmDeleteId(null);

      // Nothing left to edit — the day is gone from the list behind the panel.
      if (remaining.length === 0) {
        onClose();
      }
    } catch (caught) {
      setFormError(apiErrorToastMessage(caught));
    } finally {
      setDeletingId(null);
    }
  }

  const footer = (
    <div className="flex gap-2">
      <button
        type="submit"
        form="timesheet-day-group-form"
        disabled={isBusy}
        className="flex-1 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-contrast disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? 'Se salvează…' : 'Salvează'}
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
      title="Editează ziua"
      onClose={onClose}
      disableClose={isBusy}
      footer={footer}
    >
      <form
        id="timesheet-day-group-form"
        onSubmit={(event) => void handleSubmit(event)}
        className="flex flex-col gap-4"
      >
        <div>
          <p className="text-sm font-medium text-text-primary">{personName}</p>
          <p className="mt-0.5 text-xs text-text-muted">
            {entries.length === 1 ? '1 pontaj' : `${entries.length} pontaje`}
          </p>
        </div>

        <DateField
          id="dayGroupWorkDate"
          label="Data"
          value={workDate}
          disabled={isBusy}
          required
          onChange={setWorkDate}
        />
        {dateChanged && (
          <p className="-mt-2 text-xs text-text-muted">
            Data se aplică tuturor pontajelor din această zi.
          </p>
        )}

        <div className="flex flex-col gap-3 border-t border-border-subtle pt-4">
          <p className="text-xs font-medium text-text-secondary">Detalii pontaje</p>

          {entries.map((entry, index) => {
            const draft = drafts[entry.id];

            if (!draft) {
              return null;
            }

            return (
              <div
                key={entry.id}
                className="flex flex-col gap-3 rounded-md border border-border-subtle bg-surface p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-text-muted">Pontaj {index + 1}</p>
                  {confirmDeleteId !== entry.id && (
                    <button
                      type="button"
                      disabled={isBusy}
                      aria-label={`Șterge pontajul ${index + 1}`}
                      title="Șterge pontajul"
                      onClick={() => setConfirmDeleteId(entry.id)}
                      className="shrink-0 rounded p-1.5 text-text-muted transition-colors hover:bg-surface-raised hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <i className="ti ti-trash text-base" aria-hidden="true" />
                    </button>
                  )}
                </div>

                {confirmDeleteId === entry.id ? (
                  <div
                    role="alertdialog"
                    aria-labelledby={`delete-entry-${entry.id}`}
                    className="rounded-md border border-border-subtle bg-surface-raised p-3"
                  >
                    <p id={`delete-entry-${entry.id}`} className="text-sm text-text-secondary">
                      Sigur ștergi acest pontaj?
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleDeleteEntry(entry.id)}
                        className="flex-1 rounded-md bg-[var(--color-timer-stop)] px-4 py-2 text-sm font-medium text-[var(--color-timer-stop-text)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingId === entry.id ? 'Se șterge…' : 'Șterge'}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => setConfirmDeleteId(null)}
                        className="flex-1 rounded-md border border-border px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Anulează
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <SelectField
                      id={`project-${entry.id}`}
                      label="Proiect"
                      value={draft.projectId}
                      disabled={isBusy}
                      required
                      options={projectOptions}
                      onChange={(value) => updateDraft(entry.id, 'projectId', value)}
                    />

                    {/* A pontaj that already has an activity can't go back to
                        having none — the API has no way to unset it. */}
                    <SelectField
                      id={`activity-${entry.id}`}
                      label="Activitate"
                      value={draft.activityId}
                      disabled={isBusy}
                      required={entry.activityId !== null}
                      allowEmpty={entry.activityId === null}
                      placeholder={NO_ACTIVITY_LABEL}
                      options={activityOptions}
                      onChange={(value) => updateDraft(entry.id, 'activityId', value)}
                    />

                    <TextField
                      id={`duration-${entry.id}`}
                      label="Durată"
                      value={draft.duration}
                      error={durationErrors[entry.id]}
                      disabled={isBusy}
                      required
                      placeholder={DURATION_PLACEHOLDER}
                      onChange={(value) => updateDraft(entry.id, 'duration', value)}
                    />

                    {tracksAssemblies(draft.activityId) && (
                      <TimesheetAssemblyFields
                        idPrefix={`entry-${entry.id}`}
                        projectId={draft.projectId}
                        activityId={draft.activityId}
                        value={draft.assemblies}
                        savedAssemblies={entry.assemblies}
                        savedActivityId={entry.activityId}
                        disabled={isBusy}
                        onChange={(next) => updateAssemblies(entry.id, next)}
                      />
                    )}

                    <div>
                      <label htmlFor={`notes-${entry.id}`} className={FORM_LABEL_CLASS}>
                        Notițe
                      </label>
                      <textarea
                        id={`notes-${entry.id}`}
                        rows={2}
                        value={draft.notes}
                        disabled={isBusy}
                        onChange={(event) => updateDraft(entry.id, 'notes', event.target.value)}
                        className={`${FORM_FIELD_CLASS} resize-none`}
                        {...businessAutofill}
                      />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {formError && (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        )}
      </form>
    </SlideOverPanel>
  );
}

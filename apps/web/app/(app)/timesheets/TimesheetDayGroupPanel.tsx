'use client';

import {
  deleteTimesheet,
  updateTimesheet,
  type TimesheetDayGroupDto,
  type TimesheetDto,
} from '@fabxpert/shared';
import { useEffect, useState, type FormEvent } from 'react';
import {
  durationMinutesToHoursInput,
  isoToDateInput,
  parseDurationMinutesInput,
} from './timesheetFormat';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import { DateField } from '@/components/DateField';
import { TextField } from '@/components/TextField';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';

/** Mirrors what parseDurationMinutesInput accepts. */
const DURATION_PLACEHOLDER = 'ex. 9h, 1h30 sau 45m';
const DURATION_ERROR_MESSAGE = 'Durata trebuie să fie de forma 9h, 1h30 sau 45m.';

function durationsFromGroup(group: TimesheetDayGroupDto): Record<string, string> {
  return Object.fromEntries(
    group.entries.map((entry) => [entry.id, durationMinutesToHoursInput(entry.durationMinutes)]),
  );
}

function entryActivityName(entry: TimesheetDto): string {
  return entry.activity?.name ?? 'Fără activitate';
}

function entryProjectLabel(entry: TimesheetDto): string {
  const parts = [entry.project.code, entry.project.denumireLucrare, entry.project.company.name];
  return parts.filter(Boolean).join(' · ');
}

export interface TimesheetDayGroupPanelProps {
  open: boolean;
  group: TimesheetDayGroupDto;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Edits one person-day: the date moves every entry of that day, and each
 * activity keeps its own duration.
 */
export function TimesheetDayGroupPanel({
  open,
  group,
  onClose,
  onSaved,
}: TimesheetDayGroupPanelProps) {
  const { showToast } = useToast();
  // Deleting an entry drops it from the list without closing the panel, so the
  // day's entries live in state instead of being read straight off the prop.
  const [entries, setEntries] = useState<TimesheetDto[]>(group.entries);
  const [workDate, setWorkDate] = useState(() => isoToDateInput(group.workDate));
  const [durations, setDurations] = useState<Record<string, string>>(() =>
    durationsFromGroup(group),
  );
  const [durationErrors, setDurationErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setEntries(group.entries);
    setWorkDate(isoToDateInput(group.workDate));
    setDurations(durationsFromGroup(group));
    setDurationErrors({});
    setFormError(null);
    setConfirmDeleteId(null);
  }, [group]);

  const personName = `${group.person.firstName} ${group.person.lastName}`;
  const dateChanged = workDate !== isoToDateInput(group.workDate);
  const isBusy = isSubmitting || deletingId !== null;

  function updateDuration(entryId: string, value: string) {
    setDurations((current) => ({ ...current, [entryId]: value }));
    setDurationErrors((current) => {
      if (!current[entryId]) {
        return current;
      }
      const next = { ...current };
      delete next[entryId];
      return next;
    });
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
      const minutes = parseDurationMinutesInput(durations[entry.id] ?? '');
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

    // Only the entries that actually changed are sent.
    const updates = entries.flatMap((entry) => {
      const minutes = parsedDurations.get(entry.id)!;
      const payload = {
        ...(dateChanged ? { workDate } : {}),
        ...(minutes !== entry.durationMinutes ? { durationMinutes: minutes } : {}),
      };

      return Object.keys(payload).length > 0 ? [{ id: entry.id, payload }] : [];
    });

    if (updates.length === 0) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    try {
      for (const update of updates) {
        await updateTimesheet(update.id, update.payload);
      }
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
      setDurations((current) => {
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
          <p className="text-xs font-medium text-text-secondary">Durată pe activitate</p>

          {entries.map((entry) => (
            <div key={entry.id} className="flex flex-col gap-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-text-primary">{entryActivityName(entry)}</p>
                  <p className="truncate text-xs text-text-muted">{entryProjectLabel(entry)}</p>
                </div>
                {confirmDeleteId !== entry.id && (
                  <button
                    type="button"
                    disabled={isBusy}
                    aria-label={`Șterge pontajul ${entryActivityName(entry)}`}
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
                  className="rounded-md border border-border-subtle bg-surface p-3"
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
                <TextField
                  id={`duration-${entry.id}`}
                  label=""
                  value={durations[entry.id] ?? ''}
                  error={durationErrors[entry.id]}
                  disabled={isBusy}
                  placeholder={DURATION_PLACEHOLDER}
                  onChange={(value) => updateDuration(entry.id, value)}
                />
              )}
            </div>
          ))}
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

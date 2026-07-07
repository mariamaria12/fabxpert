import { ApiError, updateTimesheet } from '@fabxpert/shared';
import type { TimesheetDto } from '@fabxpert/shared';
import { useState } from 'react';
import { DurationInput } from './DurationInput';
import { useDurationInput } from '../hooks/useDurationInput';
import {
  endTimeFromStartAndHours,
  hoursFromEntryDuration,
  isEditableTodayEntry,
} from '../utils/timeUtils';

interface TimesheetEditProps {
  timesheet: TimesheetDto;
  onSaved: () => void;
  onCancel: () => void;
}

export function TimesheetEdit({ timesheet, onSaved, onCancel }: TimesheetEditProps) {
  const initialHours = hoursFromEntryDuration(timesheet) ?? 1;
  const {
    hoursInput,
    setHoursInput,
    parsedHours,
    canSave,
    hourStep,
    adjustHours,
    setHoursPreset,
  } = useDurationInput(initialHours);
  const [notes, setNotes] = useState(timesheet.notes ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // UI-only: only today's closed entries are editable in mobile. The API PATCH
  // remains unrestricted for an employee's own entries — post-MVP we'll allow
  // editing older entries without a server-side date gate.
  if (!isEditableTodayEntry(timesheet)) {
    return (
      <div className="flow-content">
        <p className="flow-status">Acest pontaj nu poate fi editat.</p>
        <button type="button" className="flow-secondary-button" onClick={onCancel}>
          Înapoi
        </button>
      </div>
    );
  }

  async function handleSave() {
    if (!parsedHours || isSaving) {
      return;
    }

    setFormError(null);
    setIsSaving(true);

    try {
      const startTime = new Date(timesheet.startTime);
      // Keep the original startTime; endTime reflects the adjusted duration.
      const endTime = endTimeFromStartAndHours(startTime, parsedHours);

      await updateTimesheet(timesheet.id, {
        startTime,
        endTime,
        notes: notes.trim() || undefined,
      });

      onSaved();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 0) {
        setFormError('Nu s-a putut contacta serverul.');
      } else if (caught instanceof ApiError) {
        setFormError(caught.message);
      } else {
        setFormError('A apărut o eroare. Încearcă din nou.');
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className="flow-content">
        {/* Project and activity are intentionally not editable here — changing what
            was worked on is admin territory (post-MVP). */}
        <h2 className="flow-heading">Editează pontajul</h2>

        <DurationInput
          hoursInput={hoursInput}
          parsedHours={parsedHours}
          hourStep={hourStep}
          onHoursInputChange={(value) => {
            setHoursInput(value);
            setFormError(null);
          }}
          onAdjustHours={adjustHours}
          onPreset={setHoursPreset}
        />

        <label className="notes-field">
          <span className="notes-field-label">Observații (opțional)</span>
          <textarea
            className="notes-textarea"
            rows={3}
            placeholder="Detalii despre lucrare…"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>

        {hoursInput !== '' && !canSave ? (
          <p className="flow-inline-error" role="alert">
            Introdu un număr valid de ore (ex. 4 sau 4,5)
          </p>
        ) : null}

        {formError ? (
          <p className="flow-inline-error" role="alert">
            {formError}
          </p>
        ) : null}
      </div>

      <div className="flow-footer flow-footer-stack">
        <button
          type="button"
          className="flow-primary-button"
          disabled={!canSave || isSaving}
          onClick={() => void handleSave()}
        >
          {isSaving ? 'Se salvează…' : 'Salvează modificările'}
        </button>

        <button
          type="button"
          className="flow-secondary-button"
          disabled={isSaving}
          onClick={onCancel}
        >
          Renunță
        </button>
      </div>
    </>
  );
}

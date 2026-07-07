import { ApiError, createTimesheet } from '@fabxpert/shared';
import type { ActivityDto, ProjectOptionDto } from '@fabxpert/shared';
import { useState } from 'react';
import { DurationInput } from './DurationInput';
import { useDurationInput } from '../hooks/useDurationInput';
import { intervalEndingNow } from '../utils/timeUtils';

const DEFAULT_HOURS = 8;

interface TimeEntryProps {
  project: ProjectOptionDto;
  activity: ActivityDto;
  onSaved: () => void;
}

export function TimeEntry({ project, activity, onSaved }: TimeEntryProps) {
  const {
    hoursInput,
    setHoursInput,
    parsedHours,
    canSave,
    hourStep,
    adjustHours,
    setHoursPreset,
  } = useDurationInput(DEFAULT_HOURS);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSave() {
    if (!parsedHours || isSaving) {
      return;
    }

    const interval = intervalEndingNow(parsedHours);
    if (!interval) {
      setFormError('Introdu un număr valid de ore.');
      return;
    }

    setFormError(null);
    setSuccessMessage(null);
    setIsSaving(true);

    try {
      await createTimesheet({
        projectId: project.id,
        activityId: activity.id,
        startTime: interval.startTime,
        endTime: interval.endTime,
        notes: notes.trim() || undefined,
      });

      setSuccessMessage('Pontaj salvat.');
      window.setTimeout(() => {
        onSaved();
      }, 900);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 0) {
        setFormError('Nu s-a putut contacta serverul.');
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
        <h2 className="flow-heading">Adaugă timp</h2>

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

        {successMessage ? (
          <p className="flow-success-text" role="status">
            {successMessage}
          </p>
        ) : null}

        {formError ? (
          <p className="flow-inline-error" role="alert">
            {formError}
          </p>
        ) : null}
      </div>

      <div className="flow-footer">
        <button
          type="button"
          className="flow-primary-button"
          disabled={!canSave || isSaving || Boolean(successMessage)}
          onClick={() => void handleSave()}
        >
          {isSaving ? 'Se salvează…' : 'Salvează pontajul'}
        </button>
      </div>
    </>
  );
}

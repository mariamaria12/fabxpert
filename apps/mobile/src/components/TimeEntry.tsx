import { createTimesheet } from '@fabxpert/shared';
import type { ActivityDto, ProjectOptionDto } from '@fabxpert/shared';
import { useState } from 'react';
import { DurationInput } from './DurationInput';
import { useDurationInput } from '../hooks/useDurationInput';
import { useMobileLookupCache } from '../context/MobileLookupCacheContext';
import { useToast } from '../context/ToastContext';
import { apiErrorToastMessage } from '../utils/apiToastMessage';
import { intervalEndingNow } from '../utils/timeUtils';

const DEFAULT_HOURS = 8;

interface TimeEntryProps {
  project: ProjectOptionDto;
  activity: ActivityDto;
  onSaved: () => void;
}

export function TimeEntry({ project, activity, onSaved }: TimeEntryProps) {
  const { showToast } = useToast();
  const { refreshMyTimesheetsPage1 } = useMobileLookupCache();
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

  async function handleSave() {
    if (!parsedHours || isSaving) {
      return;
    }

    const interval = intervalEndingNow(parsedHours);
    if (!interval) {
      return;
    }

    setIsSaving(true);

    try {
      await createTimesheet({
        projectId: project.id,
        activityId: activity.id,
        startTime: interval.startTime,
        endTime: interval.endTime,
        notes: notes.trim() || undefined,
      });

      showToast('Pontaj adăugat', 'success');
      void refreshMyTimesheetsPage1({ silent: true, force: true });
      onSaved();
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flow-screen">
      <div className="flow-content">
        <h2 className="flow-heading">Adaugă timp</h2>

        <DurationInput
          hoursInput={hoursInput}
          parsedHours={parsedHours}
          hourStep={hourStep}
          onHoursInputChange={setHoursInput}
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
      </div>

      <div className="flow-footer">
        <button
          type="button"
          className="flow-primary-button"
          disabled={!canSave || isSaving}
          onClick={() => void handleSave()}
        >
          {isSaving ? 'Se salvează…' : 'Salvează pontajul'}
        </button>
      </div>
    </div>
  );
}

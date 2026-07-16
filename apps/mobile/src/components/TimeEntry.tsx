import { createTimesheet, todayDateInputValue } from '@fabxpert/shared';
import type { ActivityDto, ProjectOptionDto } from '@fabxpert/shared';
import { useMemo, useState, useId } from 'react';
import { DateField } from './DateField';
import { DurationInput } from './DurationInput';
import { useDurationInput } from '../hooks/useDurationInput';
import { useMobileLookupCache } from '../context/MobileLookupCacheContext';
import { useToast } from '../context/ToastContext';
import { apiErrorToastMessage } from '../utils/apiToastMessage';
import { getBusinessInputAutofillProps } from '../utils/inputAutofill';

const DEFAULT_HOURS = 8;

interface TimeEntryProps {
  project: ProjectOptionDto;
  activity: ActivityDto;
  onSaved: () => void;
}

export function TimeEntry({ project, activity, onSaved }: TimeEntryProps) {
  const { showToast } = useToast();
  const autofillTrapId = useId();
  const businessAutofill = useMemo(
    () => getBusinessInputAutofillProps(autofillTrapId),
    [autofillTrapId],
  );
  const { refreshMyTimesheetsPage1 } = useMobileLookupCache();
  const {
    hoursInput,
    setHoursInput,
    selectedMinutes,
    parsedDurationHours,
    canSave,
    hourStep,
    adjustHours,
    setHoursPreset,
    setMinutePreset,
    activeHourPreset,
  } = useDurationInput(DEFAULT_HOURS);
  const [notes, setNotes] = useState('');
  const [workDate, setWorkDate] = useState(todayDateInputValue);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    if (!parsedDurationHours || isSaving) {
      return;
    }

    const durationMinutes = Math.round(parsedDurationHours * 60);
    if (durationMinutes <= 0) {
      return;
    }

    setIsSaving(true);

    try {
      await createTimesheet({
        projectId: project.id,
        activityId: activity.id,
        durationMinutes,
        workDate,
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

        <DateField
          id="work-date"
          label="Data"
          value={workDate}
          required
          onChange={setWorkDate}
        />

        <DurationInput
          hoursInput={hoursInput}
          selectedMinutes={selectedMinutes}
          activeHourPreset={activeHourPreset}
          hourStep={hourStep}
          onHoursInputChange={setHoursInput}
          onAdjustHours={adjustHours}
          onHourPreset={setHoursPreset}
          onMinutePreset={setMinutePreset}
        />

        <label className="notes-field">
          <span className="notes-field-label">Observații (opțional)</span>
          <textarea
            className="notes-textarea"
            rows={3}
            placeholder="Detalii despre lucrare…"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            {...businessAutofill}
          />
        </label>

        {hoursInput !== '' && !canSave ? (
          <p className="flow-inline-error" role="alert">
            Introdu o durată validă (ex. 4h sau 2h30m)
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

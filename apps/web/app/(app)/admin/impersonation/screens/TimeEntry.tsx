import { todayDateInputValue } from '@fabxpert/shared';
import type { ActivityDto, ProjectOptionDto } from '@fabxpert/shared';
import { useMemo, useState, useId } from 'react';
import { AssemblySummary } from './AssemblySummary';
import { DateField } from './DateField';
import { DurationInput } from './DurationInput';
import { useDurationInput } from '../hooks/useDurationInput';
import { useMobileLookupCache } from '../context/MobileLookupCacheContext';
import { useToast } from '../context/ToastContext';
import { apiErrorToastMessage } from '../utils/apiToastMessage';
import { getBusinessInputAutofillProps } from '../utils/inputAutofill';
import type { AssemblySelection } from '../utils/assemblyUtils';
import { createTimesheet } from '../impersonationApi';
import { requestImpersonationConfirm } from '../impersonationSession';

const DEFAULT_HOURS = 9;

interface TimeEntryProps {
  project: ProjectOptionDto;
  activity: ActivityDto;
  /** Empty on the "helped with the assembling" path and on activities without a list. */
  assemblies: AssemblySelection[];
  onEditAssemblies: () => void;
  onSaved: () => void;
}

export function TimeEntry({
  project,
  activity,
  assemblies,
  onEditAssemblies,
  onSaved,
}: TimeEntryProps) {
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

    if (!(await requestImpersonationConfirm('add-pontaj'))) {
      return;
    }

    setIsSaving(true);

    try {
      const reportedAssemblies = assemblies
        .filter((entry) => entry.quantity > 0)
        .map((entry) => ({ assemblyId: entry.assembly.id, quantityDone: entry.quantity }));

      await createTimesheet({
        projectId: project.id,
        activityId: activity.id,
        durationMinutes,
        workDate,
        notes: notes.trim() || undefined,
        assemblies: reportedAssemblies.length > 0 ? reportedAssemblies : undefined,
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

        <AssemblySummary
          items={assemblies.map((entry) => ({
            id: entry.assembly.id,
            name: entry.assembly.name,
            quantity: entry.quantity,
          }))}
          onEdit={onEditAssemblies}
        />

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

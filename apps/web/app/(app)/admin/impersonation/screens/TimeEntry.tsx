import { parseWorkDateString, SATURDAY_WORK_MINUTES, todayDateInputValue } from '@fabxpert/shared';
import type { ActivityDto, ProjectOptionDto } from '@fabxpert/shared';
import { useEffect, useMemo, useState, useId } from 'react';
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

/** A Saturday is worked as a 7.5h day, so its pontaj starts from that. */
function defaultHoursFor(workDate: string): number {
  const isSaturday = workDate !== '' && parseWorkDateString(workDate).getDay() === 6;
  return isSaturday ? SATURDAY_WORK_MINUTES / 60 : DEFAULT_HOURS;
}

/** What was filled in on the time screen, kept while the worker steps away from it. */
export type TimeEntryDraft = {
  workDate: string;
  /** Null while the duration field holds something that is not a duration. */
  durationHours: number | null;
  notes: string;
};

interface TimeEntryProps {
  project: ProjectOptionDto;
  activity: ActivityDto;
  /** Empty on the "helped with the assembling" path and on activities without a list. */
  assemblies: AssemblySelection[];
  /** Filled in earlier for this same pontaj, before going back to the pieces. */
  draft: TimeEntryDraft | null;
  onDraftChange: (draft: TimeEntryDraft) => void;
  onEditAssemblies: () => void;
  onSaved: () => void;
}

export function TimeEntry({
  project,
  activity,
  assemblies,
  draft,
  onDraftChange,
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
  const [workDate, setWorkDate] = useState(() => draft?.workDate || todayDateInputValue());
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
    applyDefaultHours,
  } = useDurationInput(
    draft?.durationHours ?? defaultHoursFor(workDate),
    draft != null && draft.durationHours !== null,
  );
  const [notes, setNotes] = useState(draft?.notes ?? '');

  // Going back to fix the pieces takes this screen away; what was typed must
  // still be here on the way back.
  useEffect(() => {
    onDraftChange({ workDate, durationHours: parsedDurationHours, notes });
  }, [workDate, parsedDurationHours, notes, onDraftChange]);
  const [isSaving, setIsSaving] = useState(false);

  function handleWorkDateChange(value: string) {
    setWorkDate(value);
    applyDefaultHours(defaultHoursFor(value));
  }

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
          onChange={handleWorkDateChange}
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

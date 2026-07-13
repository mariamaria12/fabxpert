import { deleteTimesheet, updateTimesheet } from '@fabxpert/shared';
import type { TimesheetDto } from '@fabxpert/shared';
import { useState } from 'react';
import { DurationInput } from './DurationInput';
import { useDurationInput } from '../hooks/useDurationInput';
import { useMobileLookupCache } from '../context/MobileLookupCacheContext';
import { useToast } from '../context/ToastContext';
import { apiErrorToastMessage } from '../utils/apiToastMessage';
import {
  durationPartsFromEntry,
  isEditableTodayEntry,
} from '../utils/timeUtils';

interface TimesheetEditProps {
  timesheet: TimesheetDto;
  onSaved: () => void;
  onCancel: () => void;
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7h12Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TimesheetEdit({ timesheet, onSaved, onCancel }: TimesheetEditProps) {
  const { showToast } = useToast();
  const { refreshMyTimesheetsPage1 } = useMobileLookupCache();
  const entryParts = durationPartsFromEntry(timesheet);
  const initialDurationHours = entryParts
    ? entryParts.hours + entryParts.minutes / 60
    : 1;
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
  } = useDurationInput(initialDurationHours);
  const [notes, setNotes] = useState(timesheet.notes ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
    if (!parsedDurationHours || isSaving || isDeleting) {
      return;
    }

    setIsSaving(true);

    try {
      await updateTimesheet(timesheet.id, {
        durationMinutes: Math.round(parsedDurationHours * 60),
        notes: notes.trim() || undefined,
      });

      showToast('Pontaj actualizat', 'success');
      void refreshMyTimesheetsPage1({ silent: true, force: true });
      onSaved();
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (isDeleting || isSaving) {
      return;
    }

    setIsDeleting(true);

    try {
      await deleteTimesheet(timesheet.id);
      showToast('Pontaj șters', 'success');
      void refreshMyTimesheetsPage1({ silent: true, force: true });
      onSaved();
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flow-screen">
      <div className="flow-content">
        {/* Project and activity are intentionally not editable here — changing what
            was worked on is admin territory (post-MVP). */}
        <h2 className="flow-heading">Editează pontajul</h2>

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
          />
        </label>

        {hoursInput !== '' && !canSave ? (
          <p className="flow-inline-error" role="alert">
            Introdu o durată validă (ex. 4h sau 2h30m)
          </p>
        ) : null}

        <div className="timesheet-delete-section">
          <button
            type="button"
            className="flow-delete-link"
            disabled={isSaving || isDeleting || confirmDelete}
            onClick={() => setConfirmDelete(true)}
          >
            <TrashIcon />
            <span>Șterge pontajul</span>
          </button>
        </div>
      </div>

      <div className="flow-footer flow-footer-stack">
        {confirmDelete ? (
          <div
            className="delete-footer-confirm"
            role="alertdialog"
            aria-labelledby="delete-footer-title"
          >
            <p id="delete-footer-title" className="delete-footer-text">
              Sigur ștergi acest pontaj?
            </p>
            <div className="delete-footer-actions">
              <button
                type="button"
                className="flow-danger-filled-button"
                disabled={isDeleting}
                onClick={() => void handleDelete()}
              >
                {isDeleting ? 'Se șterge…' : 'Șterge'}
              </button>
              <button
                type="button"
                className="flow-secondary-button"
                disabled={isDeleting}
                onClick={() => setConfirmDelete(false)}
              >
                Anulează
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              className="flow-primary-button"
              disabled={!canSave || isSaving || isDeleting}
              onClick={() => void handleSave()}
            >
              {isSaving ? 'Se salvează…' : 'Salvează modificările'}
            </button>

            <button
              type="button"
              className="flow-secondary-button"
              disabled={isSaving || isDeleting}
              onClick={onCancel}
            >
              Renunță
            </button>
          </>
        )}
      </div>
    </div>
  );
}

import {
  cancelLeaveRequest,
  createLeaveRequest,
  getMyLeaveBalance,
  todayDateInputValue,
  updateLeaveRequest,
} from '@fabxpert/shared';
import type { LeaveBalanceDto, LeaveRequestDto, LeaveType } from '@fabxpert/shared';
import { useEffect, useMemo, useState, useId } from 'react';
import { useToast } from '../context/ToastContext';
import { apiErrorToastMessage } from '../utils/apiToastMessage';
import { getBusinessInputAutofillProps } from '../utils/inputAutofill';
import {
  countLeaveDaysFromIso,
  formatLeaveDayCount,
  LEAVE_TYPE_OPTIONS,
} from '../utils/leaveUtils';

interface LeaveRequestFormProps {
  editingRequest: LeaveRequestDto | null;
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

export function LeaveRequestForm({
  editingRequest,
  onSaved,
  onCancel,
}: LeaveRequestFormProps) {
  const { showToast } = useToast();
  const autofillTrapId = useId();
  const businessAutofill = useMemo(
    () => getBusinessInputAutofillProps(autofillTrapId),
    [autofillTrapId],
  );
  const isEditing = editingRequest !== null;

  const [type, setType] = useState<LeaveType>(editingRequest?.type ?? 'ODIHNA');
  const [startDate, setStartDate] = useState(
    editingRequest?.startDate ?? todayDateInputValue(),
  );
  const [endDate, setEndDate] = useState(
    editingRequest?.endDate ?? todayDateInputValue(),
  );
  const [reason, setReason] = useState(editingRequest?.reason ?? '');
  const [balance, setBalance] = useState<LeaveBalanceDto | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    void getMyLeaveBalance()
      .then(setBalance)
      .catch(() => {
        // Balance warning is optional — form still works without it.
      });
  }, []);

  const dayCount = useMemo(
    () => countLeaveDaysFromIso(startDate, endDate),
    [startDate, endDate],
  );

  const datesInvalid = Boolean(startDate && endDate && endDate < startDate);
  const canSubmit = dayCount !== null && dayCount > 0 && !datesInvalid && !isSaving && !isDeleting;

  const showOverBalanceWarning =
    type === 'ODIHNA' &&
    balance !== null &&
    dayCount !== null &&
    dayCount > balance.remainingDays;

  async function handleSubmit() {
    if (!canSubmit) {
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        type,
        startDate,
        endDate,
        reason: reason.trim() || undefined,
      };

      if (isEditing && editingRequest) {
        await updateLeaveRequest(editingRequest.id, payload);
        showToast('Cerere actualizată', 'success');
      } else {
        await createLeaveRequest(payload);
        showToast('Cerere trimisă', 'success');
      }

      onSaved();
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!isEditing || !editingRequest || isDeleting || isSaving) {
      return;
    }

    setIsDeleting(true);

    try {
      await cancelLeaveRequest(editingRequest.id);
      showToast('Cerere anulată', 'success');
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
        <h2 className="flow-heading">
          {isEditing ? 'Editează cererea' : 'Cerere nouă'}
        </h2>

        <fieldset className="leave-type-field">
          <legend className="time-field-label">Tip concediu</legend>
          <div className="leave-type-segmented" role="group" aria-label="Tip concediu">
            {LEAVE_TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`leave-type-segment${type === option.value ? ' leave-type-segment-active' : ''}`}
                aria-pressed={type === option.value}
                onClick={() => setType(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="leave-date-range">
          <label className="time-field">
            <span className="time-field-label">De la</span>
            <input
              type="date"
              className="time-input leave-date-input"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              {...businessAutofill}
            />
          </label>

          <label className="time-field">
            <span className="time-field-label">Până la</span>
            <input
              type="date"
              className="time-input leave-date-input"
              value={endDate}
              min={startDate || undefined}
              onChange={(event) => setEndDate(event.target.value)}
              {...businessAutofill}
            />
          </label>
        </div>

        {datesInvalid ? (
          <p className="flow-inline-error" role="alert">
            Data de sfârșit trebuie să fie după data de început
          </p>
        ) : null}

        {dayCount !== null && !datesInvalid ? (
          <p className="duration-chip" aria-live="polite">
            {formatLeaveDayCount(dayCount)}
          </p>
        ) : null}

        {showOverBalanceWarning && balance ? (
          <p className="leave-over-balance-warning" role="status">
            Depășești zilele rămase ({balance.remainingDays}).
          </p>
        ) : null}

        <label className="notes-field">
          <span className="notes-field-label">Motiv (opțional)</span>
          <textarea
            className="notes-textarea"
            rows={3}
            placeholder="Motivul cererii…"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            {...businessAutofill}
          />
        </label>

        {isEditing ? (
          <div className="timesheet-delete-section">
            <button
              type="button"
              className="flow-delete-link"
              disabled={isSaving || isDeleting || confirmDelete}
              onClick={() => setConfirmDelete(true)}
            >
              <TrashIcon />
              <span>Anulează cererea</span>
            </button>
          </div>
        ) : null}
      </div>

      <div className="flow-footer flow-footer-stack">
        {confirmDelete ? (
          <div
            className="delete-footer-confirm"
            role="alertdialog"
            aria-labelledby="cancel-leave-footer-title"
          >
            <p id="cancel-leave-footer-title" className="delete-footer-text">
              Sigur anulezi această cerere?
            </p>
            <div className="delete-footer-actions">
              <button
                type="button"
                className="flow-danger-filled-button"
                disabled={isDeleting}
                onClick={() => void handleDelete()}
              >
                {isDeleting ? 'Se anulează…' : 'Anulează cererea'}
              </button>
              <button
                type="button"
                className="flow-secondary-button"
                disabled={isDeleting}
                onClick={() => setConfirmDelete(false)}
              >
                Renunță
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              className="flow-primary-button"
              disabled={!canSubmit}
              onClick={() => void handleSubmit()}
            >
              {isSaving
                ? 'Se salvează…'
                : isEditing
                  ? 'Salvează'
                  : 'Trimite cererea'}
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

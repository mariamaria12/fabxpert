import {
  cancelLeaveRequest,
  createLeaveRequest,
  getMyLeaveBalance,
  todayDateInputValue,
  updateLeaveRequest,
  COMMON_LEAVE_TYPE_VALUES,
  DAILY_WORK_MINUTES,
  formatOvertimeHours,
} from '@fabxpert/shared';
import type { LeaveBalanceDto, LeaveRequestDto, LeaveType } from '@fabxpert/shared';
import { useEffect, useMemo, useState, useId } from 'react';
import { DateField } from './DateField';
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
  // Odihnă and Liber cover almost every request; the other two hide behind "+".
  const [showAllTypes, setShowAllTypes] = useState(
    editingRequest ? !COMMON_LEAVE_TYPE_VALUES.includes(editingRequest.type) : false,
  );
  const [startDate, setStartDate] = useState(
    editingRequest?.startDate ?? todayDateInputValue(),
  );
  const [endDate, setEndDate] = useState(
    editingRequest?.endDate ?? todayDateInputValue(),
  );
  const [unit, setUnit] = useState<'days' | 'hours'>(
    editingRequest?.durationMinutes != null ? 'hours' : 'days',
  );
  const [hoursValue, setHoursValue] = useState(
    editingRequest?.durationMinutes != null
      ? String(editingRequest.durationMinutes / 60)
      : '1',
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

  // Hours off only make sense for RECUPERARE, and always on a single day.
  const isHours = type === 'RECUPERARE' && unit === 'hours';
  const effectiveEndDate = isHours ? startDate : endDate;

  const dayCount = useMemo(
    () => countLeaveDaysFromIso(startDate, effectiveEndDate),
    [startDate, effectiveEndDate],
  );

  const durationMinutes = useMemo(() => {
    if (!isHours) {
      return null;
    }

    const parsed = Number.parseFloat(hoursValue.replace(',', '.'));
    if (!Number.isFinite(parsed)) {
      return null;
    }

    const minutes = Math.round(parsed * 60);
    return minutes >= 15 && minutes <= DAILY_WORK_MINUTES ? minutes : null;
  }, [isHours, hoursValue]);

  const datesInvalid = Boolean(!isHours && startDate && endDate && endDate < startDate);
  const canSubmit =
    dayCount !== null &&
    dayCount > 0 &&
    !datesInvalid &&
    (!isHours || durationMinutes !== null) &&
    !isSaving &&
    !isDeleting;

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
        endDate: effectiveEndDate,
        reason: reason.trim() || undefined,
      };

      if (isEditing && editingRequest) {
        // null clears the hours and turns it back into a whole-day request.
        await updateLeaveRequest(editingRequest.id, {
          ...payload,
          durationMinutes: isHours ? durationMinutes : null,
        });
        showToast('Cerere actualizată', 'success');
      } else {
        await createLeaveRequest({
          ...payload,
          ...(isHours && durationMinutes !== null ? { durationMinutes } : {}),
        });
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
            {LEAVE_TYPE_OPTIONS.filter(
              (option) => showAllTypes || COMMON_LEAVE_TYPE_VALUES.includes(option.value),
            ).map((option) => (
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

            {!showAllTypes && (
              <button
                type="button"
                className="leave-type-segment leave-type-segment-more"
                aria-label="Arată și celelalte tipuri"
                onClick={() => setShowAllTypes(true)}
              >
                +
              </button>
            )}
          </div>
        </fieldset>

        {type === 'RECUPERARE' ? (
          <fieldset className="leave-type-field">
            <legend className="time-field-label">Cât liber</legend>
            <div className="leave-type-segmented" role="group" aria-label="Zile sau ore">
              <button
                type="button"
                className={`leave-type-segment${unit === 'days' ? ' leave-type-segment-active' : ''}`}
                aria-pressed={unit === 'days'}
                onClick={() => setUnit('days')}
              >
                Zile
              </button>
              <button
                type="button"
                className={`leave-type-segment${unit === 'hours' ? ' leave-type-segment-active' : ''}`}
                aria-pressed={unit === 'hours'}
                onClick={() => setUnit('hours')}
              >
                Ore
              </button>
            </div>
          </fieldset>
        ) : null}

        <div className="leave-date-range">
          <DateField
            id="leave-start-date"
            label={isHours ? 'Data' : 'De la'}
            value={startDate}
            required
            className="time-input leave-date-input"
            onChange={setStartDate}
          />

          {isHours ? (
            <label className="time-field">
              <span className="time-field-label">Ore</span>
              <input
                id="leave-hours"
                className="time-input leave-date-input"
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0.25"
                max={DAILY_WORK_MINUTES / 60}
                value={hoursValue}
                onChange={(event) => setHoursValue(event.target.value)}
              />
            </label>
          ) : (
            <DateField
              id="leave-end-date"
              label="Până la"
              value={endDate}
              required
              className="time-input leave-date-input"
              onChange={setEndDate}
            />
          )}
        </div>

        {isHours && durationMinutes === null ? (
          <p className="flow-inline-error" role="alert">
            Introdu între 15 minute și {DAILY_WORK_MINUTES / 60} ore
          </p>
        ) : null}

        {datesInvalid ? (
          <p className="flow-inline-error" role="alert">
            Data de sfârșit trebuie să fie după data de început
          </p>
        ) : null}

        {isHours ? (
          durationMinutes !== null ? (
            <p className="duration-chip" aria-live="polite">
              {formatOvertimeHours(durationMinutes)}
            </p>
          ) : null
        ) : dayCount !== null && !datesInvalid ? (
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

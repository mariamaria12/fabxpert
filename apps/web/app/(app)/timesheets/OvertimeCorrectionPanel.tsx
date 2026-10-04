'use client';

import {
  createOvertimeCorrection,
  deleteOvertimeCorrection,
  formatOvertimeBalance,
  formatOvertimeHours,
  MAX_OVERTIME_CORRECTION_MINUTES,
  MAX_WEEKEND_HOURS_MINUTES,
  setOvertimeWeekendHours,
  type OvertimeBalanceRowDto,
  formatPersonName,
} from '@fabxpert/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import { TextField } from '@/components/TextField';
import { FORM_FIELD_CLASS, FORM_LABEL_CLASS } from '@/components/formFieldStyles';
import { useBusinessAutofillProps } from '@/components/inputAutofill';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { durationMinutesToHoursInput, parseDurationMinutesInput } from './timesheetFormat';
import { formatMonthLabel } from './timesheetMonths';

interface OvertimeCorrectionPanelProps {
  row: OvertimeBalanceRowDto | null;
  /** The month the row describes, as `YYYY-MM`. */
  month: string;
  /** The balance is only set by hand on the current month. */
  canCorrectBalance: boolean;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Whether the month has weekend hours to correct: some were logged, or a
 * correction already stands. A month approved with the weekend in the balance
 * has none.
 */
export function hasWeekendHours({ balance }: OvertimeBalanceRowDto): boolean {
  return (
    balance.loggedSaturdayMinutes !== null &&
    (balance.weekendCorrection !== null ||
      (balance.saturdayMinutes ?? 0) > 0 ||
      (balance.sundayMinutes ?? 0) > 0)
  );
}

/** Minutes as the field shows them: "9h", "7h30m", "0". */
function weekendInput(minutes: number | null): string {
  return minutes !== null && minutes > 0 ? durationMinutesToHoursInput(minutes) : '0';
}

/** Signed hours as typed: "0", "12", "-4", "+3h30", "−1,5". Null when unreadable. */
function parseSignedMinutes(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }

  const negative = /^[-−]/.test(trimmed);
  const unsigned = trimmed.replace(/^[-−+]\s*/, '');
  if (/^0+([.,]0+)?\s*h?$/i.test(unsigned)) {
    return 0;
  }

  const minutes = parseDurationMinutesInput(unsigned);
  if (minutes === null) {
    return null;
  }

  return negative ? -minutes : minutes;
}

function formatCorrectionDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Sets one person's overtime balance by hand, or undoes the last correction —
 * and, where the month has any, its Saturday and Sunday hours.
 */
export function OvertimeCorrectionPanel({
  row,
  month,
  canCorrectBalance,
  onClose,
  onSaved,
}: OvertimeCorrectionPanelProps) {
  const { showToast } = useToast();
  const businessAutofill = useBusinessAutofillProps();
  const [value, setValue] = useState('');
  const [saturday, setSaturday] = useState('');
  const [sunday, setSunday] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [weekendError, setWeekendError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmUndo, setConfirmUndo] = useState(false);

  useEffect(() => {
    setValue('');
    setSaturday(weekendInput(row?.balance.saturdayMinutes ?? null));
    setSunday(weekendInput(row?.balance.sundayMinutes ?? null));
    setNote('');
    setError(null);
    setWeekendError(null);
    setConfirmUndo(false);
    // The fields restart from the row as it was opened, not on every refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.person.id, month]);

  if (!row) {
    return null;
  }

  const { person, balance } = row;
  const fullName = formatPersonName(person);
  const parsed = parseSignedMinutes(value);
  const showWeekend = hasWeekendHours(row);
  // With weekend hours on the panel the balance may be left alone.
  const balanceTyped = value.trim() !== '';

  /** A weekend field as minutes; null when it cannot be read or is out of range. */
  function parseWeekend(input: string): number | null {
    const minutes = parseSignedMinutes(input);
    return minutes === null || minutes < 0 || minutes > MAX_WEEKEND_HOURS_MINUTES ? null : minutes;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setWeekendError(null);

    const saveBalance = canCorrectBalance && (balanceTyped || !showWeekend);
    if (saveBalance) {
      if (parsed === null) {
        setError('Scrie un număr de ore, de exemplu 0, 12, -4 sau 3h30.');
        return;
      }
      if (Math.abs(parsed) > MAX_OVERTIME_CORRECTION_MINUTES) {
        setError(`Soldul poate fi cel mult ±${MAX_OVERTIME_CORRECTION_MINUTES / 60} ore.`);
        return;
      }
    }

    const saturdayMinutes = parseWeekend(saturday);
    const sundayMinutes = parseWeekend(sunday);
    if (showWeekend && (saturdayMinutes === null || sundayMinutes === null)) {
      setWeekendError('Scrie orele ca număr pozitiv, de exemplu 0, 8, 7.5 sau 7h30.');
      return;
    }
    const weekendChanged =
      showWeekend &&
      (saturdayMinutes !== (balance.saturdayMinutes ?? 0) ||
        sundayMinutes !== (balance.sundayMinutes ?? 0));

    if (!saveBalance && !weekendChanged) {
      setWeekendError('Nu ai schimbat nimic.');
      return;
    }

    setBusy(true);
    try {
      if (weekendChanged) {
        await setOvertimeWeekendHours({
          personId: person.id,
          month,
          // A value equal to what was logged needs no correction of its own.
          saturdayMinutes:
            saturdayMinutes === balance.loggedSaturdayMinutes ? null : saturdayMinutes,
          sundayMinutes: sundayMinutes === balance.loggedSundayMinutes ? null : sundayMinutes,
          note: note.trim() || undefined,
        });
      }
      if (saveBalance && parsed !== null) {
        await createOvertimeCorrection({
          personId: person.id,
          balanceMinutes: parsed,
          note: note.trim() || undefined,
        });
      }
      showToast(
        saveBalance && parsed !== null
          ? `Soldul lui ${fullName} a fost setat la ${formatOvertimeBalance(parsed)}.`
          : `Orele de weekend ale lui ${fullName} au fost corectate.`,
        'success',
      );
      onSaved();
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleWeekendReset() {
    setBusy(true);
    try {
      await setOvertimeWeekendHours({
        personId: person.id,
        month,
        saturdayMinutes: null,
        sundayMinutes: null,
      });
      showToast(`Orele de weekend ale lui ${fullName} sunt din nou cele pontate.`, 'success');
      onSaved();
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleUndo() {
    if (!balance.correction) {
      return;
    }

    setBusy(true);
    try {
      await deleteOvertimeCorrection(balance.correction.id);
      showToast(`Corecția pentru ${fullName} a fost anulată.`, 'success');
      onSaved();
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setBusy(false);
    }
  }

  const footer = confirmUndo ? (
    <div role="alertdialog" aria-labelledby="overtime-undo-title">
      <p id="overtime-undo-title" className="text-sm text-text-secondary">
        Anulezi corecția? Soldul revine la calculul din pontaje.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleUndo()}
          className="flex-1 rounded-md bg-[var(--color-timer-stop)] px-4 py-2.5 text-sm font-medium text-[var(--color-timer-stop-text)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Se anulează…' : 'Anulează corecția'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setConfirmUndo(false)}
          className="flex-1 rounded-md border border-border px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Înapoi
        </button>
      </div>
    </div>
  ) : (
    <div className="flex gap-2">
      <button
        type="submit"
        form="overtime-correction-form"
        disabled={busy}
        className="flex-1 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-contrast disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? 'Se salvează…' : 'Salvează'}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onClose}
        className="rounded-md border border-border px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        Renunță
      </button>
    </div>
  );

  return (
    <SlideOverPanel
      open
      title={`Ore suplimentare — ${fullName}`}
      onClose={onClose}
      disableClose={busy}
      footer={footer}
    >
      <form id="overtime-correction-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        {canCorrectBalance ? (
          <>
            <div className="rounded-md border border-border-subtle px-4 py-3">
              <p className="text-xs text-text-muted">Sold actual</p>
              <p
                className={`mt-0.5 text-lg font-medium tabular-nums ${
                  balance.remainingMinutes < 0 ? 'text-danger' : 'text-text-primary'
                }`}
              >
                {formatOvertimeBalance(balance.remainingMinutes)}
              </p>
            </div>

            <div>
              <TextField
                id="overtimeBalance"
                label="Sold nou (ore)"
                inputMode="text"
                placeholder="0"
                value={value}
                error={error ?? undefined}
                disabled={busy}
                onChange={(next) => {
                  setValue(next);
                  setError(null);
                }}
              />
              <p className="mt-1 text-xs text-text-muted">
                0 șterge tot soldul, un număr negativ e o datorie (de exemplu -4). Valoarea
                înlocuiește tot ce era până azi, inclusiv o lună încă neaprobată, care nu se mai
                plătește. Orele pontate de azi încolo se adaugă peste.
                {showWeekend ? ' Lasă gol dacă schimbi doar orele de weekend.' : ''}
              </p>
            </div>
          </>
        ) : null}

        {showWeekend ? (
          <div className="rounded-md border border-border-subtle px-4 py-3">
            <p className="text-sm font-medium text-text-primary">
              Ore de weekend — {formatMonthLabel(month).toLowerCase()}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <TextField
                id="overtimeSaturdayHours"
                label="Ore sâmbătă"
                inputMode="text"
                value={saturday}
                disabled={busy}
                onChange={(next) => {
                  setSaturday(next);
                  setWeekendError(null);
                }}
              />
              <TextField
                id="overtimeSundayHours"
                label="Ore duminică"
                inputMode="text"
                value={sunday}
                disabled={busy}
                onChange={(next) => {
                  setSunday(next);
                  setWeekendError(null);
                }}
              />
            </div>
            {weekendError ? (
              <p role="alert" className="mt-2 text-xs text-danger">
                {weekendError}
              </p>
            ) : null}
            <p className="mt-2 text-xs text-text-muted">
              Pontate: {formatOvertimeHours(balance.loggedSaturdayMinutes ?? 0)} sâmbăta și de
              sărbători, {formatOvertimeHours(balance.loggedSundayMinutes ?? 0)} duminica. Valoarea
              înlocuiește totalul lunii în coloanele de ore și în documentul pentru contabilitate;
              pontajele rămân neschimbate.
            </p>
            {balance.weekendCorrection ? (
              <div className="mt-3 border-t border-border-subtle pt-3">
                <p className="text-xs text-text-muted">
                  Corectat manual pe {formatCorrectionDate(balance.weekendCorrection.updatedAt)}
                  {balance.weekendCorrection.updatedBy
                    ? ` de ${formatPersonName(balance.weekendCorrection.updatedBy)}`
                    : ''}
                  .{balance.weekendCorrection.note ? ` „${balance.weekendCorrection.note}”` : ''}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleWeekendReset()}
                  className="mt-2 inline-flex items-center gap-2 text-sm text-danger transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <i className="ti ti-arrow-back-up text-base" aria-hidden="true" />
                  <span>Revino la orele pontate</span>
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <div>
          <label htmlFor="overtimeNote" className={FORM_LABEL_CLASS}>
            Motiv
          </label>
          <textarea
            id="overtimeNote"
            rows={3}
            maxLength={500}
            value={note}
            disabled={busy}
            onChange={(event) => setNote(event.target.value)}
            className={`${FORM_FIELD_CLASS} resize-none`}
            {...businessAutofill}
          />
        </div>

        {canCorrectBalance && balance.correction && !confirmUndo ? (
          <div className="mt-2 border-t border-border-subtle pt-4">
            <p className="text-xs text-text-muted">
              Corectat manual pe {formatCorrectionDate(balance.correction.createdAt)}
              {balance.correction.createdBy
                ? ` de ${formatPersonName(balance.correction.createdBy)}`
                : ''}
              : din {formatOvertimeBalance(balance.correction.previousBalanceMinutes)} în{' '}
              {formatOvertimeBalance(balance.correction.balanceMinutes)}.
              {balance.correction.note ? ` „${balance.correction.note}”` : ''}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmUndo(true)}
              className="mt-2 inline-flex items-center gap-2 text-sm text-danger transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <i className="ti ti-arrow-back-up text-base" aria-hidden="true" />
              <span>Anulează corecția</span>
            </button>
          </div>
        ) : null}
      </form>
    </SlideOverPanel>
  );
}

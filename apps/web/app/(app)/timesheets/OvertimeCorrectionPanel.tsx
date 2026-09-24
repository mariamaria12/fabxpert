'use client';

import {
  createOvertimeCorrection,
  deleteOvertimeCorrection,
  formatOvertimeBalance,
  MAX_OVERTIME_CORRECTION_MINUTES,
  type OvertimeBalanceRowDto,
} from '@fabxpert/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import { TextField } from '@/components/TextField';
import { FORM_FIELD_CLASS, FORM_LABEL_CLASS } from '@/components/formFieldStyles';
import { useBusinessAutofillProps } from '@/components/inputAutofill';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { parseDurationMinutesInput } from './timesheetFormat';

interface OvertimeCorrectionPanelProps {
  row: OvertimeBalanceRowDto | null;
  onClose: () => void;
  onSaved: () => void;
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

/** Sets one person's overtime balance by hand, or undoes the last correction. */
export function OvertimeCorrectionPanel({ row, onClose, onSaved }: OvertimeCorrectionPanelProps) {
  const { showToast } = useToast();
  const businessAutofill = useBusinessAutofillProps();
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmUndo, setConfirmUndo] = useState(false);

  useEffect(() => {
    setValue('');
    setNote('');
    setError(null);
    setConfirmUndo(false);
  }, [row?.person.id]);

  if (!row) {
    return null;
  }

  const { person, balance } = row;
  const fullName = `${person.firstName} ${person.lastName}`;
  const parsed = parseSignedMinutes(value);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (parsed === null) {
      setError('Scrie un număr de ore, de exemplu 0, 12, -4 sau 3h30.');
      return;
    }
    if (Math.abs(parsed) > MAX_OVERTIME_CORRECTION_MINUTES) {
      setError(`Soldul poate fi cel mult ±${MAX_OVERTIME_CORRECTION_MINUTES / 60} ore.`);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await createOvertimeCorrection({
        personId: person.id,
        balanceMinutes: parsed,
        note: note.trim() || undefined,
      });
      showToast(`Soldul lui ${fullName} a fost setat la ${formatOvertimeBalance(parsed)}.`, 'success');
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
        {busy ? 'Se salvează…' : 'Salvează soldul'}
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
            0 șterge tot soldul, un număr negativ e o datorie (de exemplu -4). Valoarea înlocuiește
            tot ce era până azi, inclusiv o lună încă neaprobată, care nu se mai plătește. Orele
            pontate de azi încolo se adaugă peste.
          </p>
        </div>

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

        {balance.correction && !confirmUndo ? (
          <div className="mt-2 border-t border-border-subtle pt-4">
            <p className="text-xs text-text-muted">
              Corectat manual pe {formatCorrectionDate(balance.correction.createdAt)}
              {balance.correction.createdBy
                ? ` de ${balance.correction.createdBy.firstName} ${balance.correction.createdBy.lastName}`
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

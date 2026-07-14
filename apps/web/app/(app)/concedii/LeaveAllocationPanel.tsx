'use client';

import { updatePerson, type LeaveBalanceDto, type PersonDto } from '@fabxpert/shared';
import { useEffect, useState } from 'react';
import { useBusinessAutofillProps } from '@/components/inputAutofill';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import { PersonName } from '@/components/PersonAvatar';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';

interface LeaveAllocationPanelProps {
  open: boolean;
  person: PersonDto;
  balance: LeaveBalanceDto | null;
  onClose: () => void;
  onSaved: () => void;
}

export function LeaveAllocationPanel({
  open,
  person,
  balance,
  onClose,
  onSaved,
}: LeaveAllocationPanelProps) {
  const { showToast } = useToast();
  const businessAutofill = useBusinessAutofillProps();
  const [annualLeaveDays, setAnnualLeaveDays] = useState(String(person.annualLeaveDays));
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setAnnualLeaveDays(String(person.annualLeaveDays));
    setFieldError(null);
  }, [person]);

  function validate(): number | null {
    const parsed = Number.parseInt(annualLeaveDays.trim(), 10);
    if (!Number.isInteger(parsed) || parsed < 0) {
      setFieldError('Introdu un număr întreg pozitiv sau zero.');
      return null;
    }

    setFieldError(null);
    return parsed;
  }

  async function handleSubmit() {
    const parsed = validate();
    if (parsed === null || isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      await updatePerson(person.id, { annualLeaveDays: parsed });
      showToast('Zile alocate actualizate', 'success');
      onSaved();
      onClose();
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setIsSaving(false);
    }
  }

  const footer = (
    <div className="flex gap-2">
      <button
        type="button"
        className="flex-1 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
        disabled={isSaving}
        onClick={() => void handleSubmit()}
      >
        {isSaving ? 'Se salvează…' : 'Salvează'}
      </button>
      <button
        type="button"
        className="flex-1 rounded-md border border-border px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:opacity-50"
        disabled={isSaving}
        onClick={onClose}
      >
        Renunță
      </button>
    </div>
  );

  return (
    <SlideOverPanel
      open={open}
      title="Zile alocate"
      onClose={onClose}
      disableClose={isSaving}
      footer={footer}
    >
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-xs text-text-muted">Angajat</p>
          <div className="mt-1 text-sm text-text-primary">
            <PersonName person={person} nameClassName="font-medium" />
          </div>
        </div>

        {balance ? (
          <div className="rounded-md border border-border-subtle bg-surface-raised px-4 py-3 text-sm text-text-secondary">
            <p>
              Folosite (an curent): <strong className="text-text-primary">{balance.usedDays}</strong>
            </p>
            <p className="mt-1">
              Rămase (după alocare curentă):{' '}
              <strong className="text-text-primary">{balance.remainingDays}</strong>
            </p>
          </div>
        ) : null}

        <label className="flex flex-col gap-2">
          <span className="text-xs text-text-muted">Zile alocate (odihnă / an)</span>
          <input
            type="number"
            min={0}
            step={1}
            value={annualLeaveDays}
            onChange={(event) => setAnnualLeaveDays(event.target.value)}
            className="w-full rounded-md border border-border bg-surface-raised px-3 py-[10px] text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            {...businessAutofill}
          />
          {fieldError ? <span className="text-xs text-danger">{fieldError}</span> : null}
        </label>
      </div>
    </SlideOverPanel>
  );
}

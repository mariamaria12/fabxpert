'use client';

import {
  ApiError,
  countInclusiveLeaveDays,
  createLeaveRequest,
  createLeaveRequestSchema,
  formatLeaveDayCount,
  getLeaveBalance,
  getLeaveTypeLabel,
  listPersons,
  parseDateDisplay,
  parseWorkDateString,
  todayDateInputValue,
  LEAVE_TYPE_VALUES,
  type LeaveBalanceDto,
  type LeaveRequestDto,
  type LeaveType,
} from '@fabxpert/shared';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import { DateField } from '@/components/DateField';
import { SelectField } from '@/components/SelectField';
import { useBusinessAutofillProps } from '@/components/inputAutofill';
import { FORM_FIELD_CLASS } from '@/components/formFieldStyles';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { loadAllPages } from '@/utils/loadAllPages';

interface LeaveFormValues {
  personId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
}

const DEFAULT_LEAVE_TYPE: LeaveType = 'ODIHNA';

function createEmptyForm(): LeaveFormValues {
  const today = todayDateInputValue();

  return {
    personId: '',
    type: DEFAULT_LEAVE_TYPE,
    startDate: today,
    endDate: today,
    reason: '',
  };
}

function buildPayload(values: LeaveFormValues) {
  return {
    personId: values.personId,
    type: values.type,
    startDate: values.startDate,
    endDate: values.endDate,
    reason: values.reason.trim() || undefined,
  };
}

function mapZodFieldErrors(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined> };
}) {
  const flat = error.flatten().fieldErrors;
  const mapped: Partial<Record<keyof LeaveFormValues, string>> = {};

  if (flat.personId?.[0]) {
    mapped.personId = 'Angajatul este obligatoriu.';
  }
  if (flat.startDate?.[0]) {
    mapped.startDate = 'Introdu data în format dd/mm/yyyy.';
  }
  if (flat.endDate?.[0]) {
    mapped.endDate = 'Data de sfârșit trebuie să fie după data de început.';
  }

  return mapped;
}

/** Working days in the range, or null while the dates aren't both valid. */
function countWorkingDays(values: LeaveFormValues): number | null {
  if (!values.startDate || !values.endDate || values.endDate < values.startDate) {
    return null;
  }

  try {
    return countInclusiveLeaveDays(
      parseWorkDateString(values.startDate),
      parseWorkDateString(values.endDate),
    );
  } catch {
    return null;
  }
}

export interface LeaveFormPanelProps {
  open: boolean;
  onClose: () => void;
  onSaved: (created: LeaveRequestDto) => void;
}

export function LeaveFormPanel({ open, onClose, onSaved }: LeaveFormPanelProps) {
  const { showToast } = useToast();
  const businessAutofill = useBusinessAutofillProps();
  const [values, setValues] = useState<LeaveFormValues>(createEmptyForm);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof LeaveFormValues, string>>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [personOptions, setPersonOptions] = useState<{ id: string; label: string }[]>([]);
  const [balance, setBalance] = useState<LeaveBalanceDto | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const typeOptions = useMemo(
    () =>
      LEAVE_TYPE_VALUES.map((type) => ({
        id: type,
        label: getLeaveTypeLabel(type),
      })),
    [],
  );

  const workingDays = countWorkingDays(values);
  const remainingAfterRequest = (balance?.remainingDays ?? 0) - (workingDays ?? 0);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    void loadAllPages((page, pageSize) => listPersons({ page, pageSize }))
      .then((persons) => {
        if (!cancelled) {
          setPersonOptions(
            persons.map((person) => ({
              id: person.id,
              label: `${person.firstName} ${person.lastName}`,
            })),
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPersonOptions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setValues(createEmptyForm());
    setFieldErrors({});
    setFormError(null);
    setIsSubmitting(false);
  }, [open]);

  // Balance for the selected person, so the admin sees how many days are left
  // before filing the request.
  useEffect(() => {
    if (!values.personId) {
      setBalance(null);
      setBalanceLoading(false);
      return;
    }

    let cancelled = false;
    setBalanceLoading(true);

    void getLeaveBalance(values.personId)
      .then((response) => {
        if (!cancelled) {
          setBalance(response);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBalance(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBalanceLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [values.personId]);

  function updateField<K extends keyof LeaveFormValues>(
    field: K,
    value: LeaveFormValues[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }
      const next = { ...current };
      delete next[field];
      return next;
    });
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setFormError(null);
    setFieldErrors({});

    const nextErrors: Partial<Record<keyof LeaveFormValues, string>> = {};
    if (!values.personId) {
      nextErrors.personId = 'Angajatul este obligatoriu.';
    }
    if (!values.startDate || !parseDateDisplay(values.startDate)) {
      nextErrors.startDate = 'Introdu data în format dd/mm/yyyy.';
    }
    if (!values.endDate || !parseDateDisplay(values.endDate)) {
      nextErrors.endDate = 'Introdu data în format dd/mm/yyyy.';
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    const parsed = createLeaveRequestSchema.safeParse(buildPayload(values));
    if (!parsed.success) {
      setFieldErrors(mapZodFieldErrors(parsed.error));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await createLeaveRequest(parsed.data);
      showToast('Concediu adăugat', 'success');
      onSaved(response.leaveRequest);
      onClose();
    } catch (caught) {
      if (caught instanceof ApiError && (caught.status === 400 || caught.status === 409)) {
        setFormError(caught.message);
      } else {
        showToast(apiErrorToastMessage(caught), 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const footer = (
    <div className="flex gap-2">
      <button
        type="submit"
        form="leave-form"
        disabled={isSubmitting}
        className="flex-1 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-contrast disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? 'Se salvează…' : 'Adaugă'}
      </button>
      <button
        type="button"
        disabled={isSubmitting}
        onClick={onClose}
        className="rounded-md border border-border px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        Anulează
      </button>
    </div>
  );

  return (
    <SlideOverPanel
      open={open}
      title="Concediu nou"
      onClose={onClose}
      disableClose={isSubmitting}
      footer={footer}
    >
      <form
        id="leave-form"
        onSubmit={(event) => void handleSubmit(event)}
        className="flex flex-col gap-4"
      >
        <SelectField
          id="leave-personId"
          label="Angajat"
          value={values.personId}
          error={fieldErrors.personId}
          disabled={isSubmitting}
          required
          allowEmpty
          placeholder="Selectează angajatul"
          options={personOptions}
          onChange={(value) => updateField('personId', value)}
        />

        {values.personId && (
          <div className="rounded-md border border-border-subtle bg-surface-raised px-3 py-2.5">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Zile disponibile (concediu de odihnă)
            </p>
            {balanceLoading ? (
              <p className="mt-1 text-sm text-text-muted">Se încarcă soldul…</p>
            ) : balance ? (
              <div className="mt-1 space-y-0.5 text-sm text-text-secondary">
                <p>
                  <strong className="text-text-primary">{balance.remainingDays}</strong> din{' '}
                  {balance.annualLeaveDays} zile ({balance.usedDays} folosite)
                </p>
                {values.type === 'ODIHNA' && workingDays !== null && workingDays > 0 && (
                  <p className={remainingAfterRequest < 0 ? 'text-danger' : undefined}>
                    După această cerere:{' '}
                    <strong className={remainingAfterRequest < 0 ? '' : 'text-text-primary'}>
                      {remainingAfterRequest}
                    </strong>{' '}
                    zile rămase
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-1 text-sm text-text-muted">Sold indisponibil.</p>
            )}
          </div>
        )}

        <SelectField
          id="leave-type"
          label="Tip concediu"
          value={values.type}
          disabled={isSubmitting}
          required
          options={typeOptions}
          onChange={(value) => updateField('type', value as LeaveType)}
        />

        <DateField
          id="leave-startDate"
          label="Data de început"
          value={values.startDate}
          error={fieldErrors.startDate}
          disabled={isSubmitting}
          required
          onChange={(value) => updateField('startDate', value)}
        />

        <DateField
          id="leave-endDate"
          label="Data de sfârșit"
          value={values.endDate}
          error={fieldErrors.endDate}
          disabled={isSubmitting}
          required
          onChange={(value) => updateField('endDate', value)}
        />

        {workingDays !== null && (
          <p className="text-xs text-text-muted">
            {workingDays > 0
              ? `${formatLeaveDayCount(workingDays)} lucrătoare (weekendurile nu se numără).`
              : 'Perioada selectată nu conține nicio zi lucrătoare.'}
          </p>
        )}

        <div>
          <label htmlFor="leave-reason" className="mb-1.5 block text-xs text-text-secondary">
            Motiv
          </label>
          <textarea
            id="leave-reason"
            rows={3}
            value={values.reason}
            disabled={isSubmitting}
            onChange={(event) => updateField('reason', event.target.value)}
            className={`${FORM_FIELD_CLASS} resize-none`}
            {...businessAutofill}
          />
        </div>

        {formError && (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        )}
      </form>
    </SlideOverPanel>
  );
}

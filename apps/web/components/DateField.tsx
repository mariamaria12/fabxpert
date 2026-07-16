'use client';

import {
  formatDateDisplayDraft,
  isoToDateDisplay,
  parseDateDisplay,
} from '@fabxpert/shared';
import { useEffect, useId, useRef, useState } from 'react';
import { FORM_FIELD_CLASS, FORM_LABEL_CLASS } from './formFieldStyles';
import { getBusinessInputAutofillProps } from './inputAutofill';

export interface DateFieldProps {
  id: string;
  label: string;
  value: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  onChange: (isoValue: string) => void;
}

export function DateField({
  id,
  label,
  value,
  error,
  required,
  disabled,
  className,
  onChange,
}: DateFieldProps) {
  const autofillTrapId = useId();
  const autofillProps = getBusinessInputAutofillProps(autofillTrapId);
  const pickerInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(() => isoToDateDisplay(value));
  const [localError, setLocalError] = useState<string | undefined>();

  useEffect(() => {
    setDraft(isoToDateDisplay(value));
  }, [value]);

  function handleChange(input: string) {
    const formatted = formatDateDisplayDraft(input);
    setDraft(formatted);
    setLocalError(undefined);

    if (!formatted) {
      onChange('');
      return;
    }

    const parsed = parseDateDisplay(formatted);
    if (parsed) {
      onChange(parsed);
    }
  }

  function handleBlur() {
    if (!draft.trim()) {
      if (required) {
        setLocalError('Data este obligatorie.');
      }
      onChange('');
      return;
    }

    const parsed = parseDateDisplay(draft);
    if (!parsed) {
      setLocalError('Introdu data în format dd/mm/yyyy.');
      setDraft(isoToDateDisplay(value));
      return;
    }

    onChange(parsed);
    setDraft(isoToDateDisplay(parsed));
  }

  function openDatePicker() {
    if (disabled) {
      return;
    }

    const picker = pickerInputRef.current;
    if (!picker) {
      return;
    }

    const pickerWithShow = picker as HTMLInputElement & {
      showPicker?: () => void;
    };

    if (typeof pickerWithShow.showPicker === 'function') {
      pickerWithShow.showPicker();
      return;
    }

    picker.click();
  }

  const shownError = error ?? localError;

  return (
    <div>
      <label htmlFor={id} className={FORM_LABEL_CLASS}>
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          placeholder="dd/mm/yyyy"
          maxLength={10}
          value={draft}
          disabled={disabled}
          required={required}
          onChange={(event) => handleChange(event.target.value)}
          onBlur={handleBlur}
          className={`${className ?? FORM_FIELD_CLASS} pr-11`}
          {...autofillProps}
          autoComplete="off"
        />
        <input
          ref={pickerInputRef}
          tabIndex={-1}
          aria-hidden="true"
          type="date"
          value={value}
          disabled={disabled}
          onChange={(event) => {
            onChange(event.target.value);
            setDraft(isoToDateDisplay(event.target.value));
            setLocalError(undefined);
          }}
          className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0"
        />
        <button
          type="button"
          aria-label="Deschide calendarul"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={openDatePicker}
          className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded text-text-secondary transition-colors hover:bg-surface hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <i className="ti ti-calendar text-base" aria-hidden="true" />
        </button>
      </div>
      {shownError && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {shownError}
        </p>
      )}
    </div>
  );
}

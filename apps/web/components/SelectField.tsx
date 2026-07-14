'use client';

import { useId } from 'react';
import { FORM_LABEL_CLASS, FORM_SELECT_CLASS } from './formFieldStyles';
import { businessAutofillFieldName } from './inputAutofill';

export interface SelectFieldOption {
  id: string;
  label: string;
}

export interface SelectFieldProps {
  id: string;
  label: string;
  value: string;
  options: SelectFieldOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  allowEmpty?: boolean;
  required?: boolean;
  disabled?: boolean;
  error?: string;
}

export function SelectField({
  id,
  label,
  value,
  options,
  onChange,
  placeholder,
  allowEmpty = false,
  required = false,
  disabled = false,
  error,
}: SelectFieldProps) {
  const autofillTrapId = useId();

  return (
    <div>
      <label htmlFor={id} className={FORM_LABEL_CLASS}>
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>

      <div className="relative">
        <select
          id={id}
          name={businessAutofillFieldName(autofillTrapId)}
          value={value}
          disabled={disabled}
          autoComplete="off"
          onChange={(event) => onChange(event.target.value)}
          className={FORM_SELECT_CLASS}
        >
          {allowEmpty && <option value="">{placeholder ?? 'Selectează…'}</option>}
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <i
          className="ti ti-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-muted"
          aria-hidden="true"
        />
      </div>

      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

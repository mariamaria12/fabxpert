'use client';

import { useState } from 'react';
import { FORM_FIELD_CLASS, FORM_LABEL_CLASS } from './formFieldStyles';
import {
  getCredentialInputAutofillProps,
  type CredentialAutoComplete,
} from './inputAutofill';

export interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  autoComplete: Extract<CredentialAutoComplete, 'new-password' | 'current-password'>;
  onChange: (value: string) => void;
}

export function PasswordField({
  id,
  label,
  value,
  error,
  required,
  disabled,
  autoComplete,
  onChange,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const autofillProps = getCredentialInputAutofillProps(autoComplete);

  return (
    <div>
      <label htmlFor={id} className={FORM_LABEL_CLASS}>
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          disabled={disabled}
          required={required}
          onChange={(event) => onChange(event.target.value)}
          className={`${FORM_FIELD_CLASS} pr-11`}
          {...autofillProps}
        />
        <button
          type="button"
          disabled={disabled}
          aria-label={visible ? 'Ascunde parola' : 'Arată parola'}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 flex min-h-[32px] min-w-[32px] w-11 items-center justify-center text-text-muted transition-colors hover:text-text-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <i
            className={`ti text-base ${visible ? 'ti-eye-off' : 'ti-eye'}`}
            aria-hidden="true"
          />
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

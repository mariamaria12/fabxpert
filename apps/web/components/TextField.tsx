'use client';

import { useId, type InputHTMLAttributes } from 'react';
import { FORM_FIELD_CLASS, FORM_LABEL_CLASS } from './formFieldStyles';
import {
  getBusinessInputAutofillProps,
  getCredentialInputAutofillProps,
  isCredentialAutoComplete,
} from './inputAutofill';

export interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'id'> {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  /** Credential autocomplete token. Omit for business fields (autofill suppressed). */
  autoComplete?: InputHTMLAttributes<HTMLInputElement>['autoComplete'];
}

export function TextField({
  id,
  label,
  value,
  error,
  required,
  disabled,
  type = 'text',
  className,
  autoComplete,
  onChange,
  ...rest
}: TextFieldProps) {
  const autofillTrapId = useId();
  const autofillProps = isCredentialAutoComplete(autoComplete)
    ? getCredentialInputAutofillProps(autoComplete)
    : getBusinessInputAutofillProps(autofillTrapId);

  return (
    <div>
      <label htmlFor={id} className={FORM_LABEL_CLASS}>
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        disabled={disabled}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className={className ?? FORM_FIELD_CLASS}
        {...autofillProps}
        {...rest}
      />
      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

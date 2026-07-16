import type { InputHTMLAttributes } from 'react';

interface DateFieldProps {
  id: string;
  label: string;
  value: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
  onChange: (isoValue: string) => void;
}

export function DateField({
  id,
  label,
  value,
  error,
  required,
  disabled,
  className = 'time-input',
  inputProps,
  onChange,
}: DateFieldProps) {
  return (
    <label className="time-field" htmlFor={id}>
      <span className="time-field-label">
        {label}
        {required ? ' *' : ''}
      </span>
      <input
        id={id}
        type="date"
        lang="ro-RO"
        autoComplete="off"
        value={value}
        disabled={disabled}
        required={required}
        className={className}
        onChange={(event) => onChange(event.target.value)}
        {...inputProps}
      />
      {error ? (
        <p className="flow-inline-error" role="alert">
          {error}
        </p>
      ) : null}
    </label>
  );
}

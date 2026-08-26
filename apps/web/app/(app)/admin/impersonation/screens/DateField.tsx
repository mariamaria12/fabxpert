import { useRef, type InputHTMLAttributes } from 'react';

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
  const inputRef = useRef<HTMLInputElement>(null);

  // The flow shell is a fixed 100dvh box, so the native picker can cover a field
  // sitting low on screen. Centring it in the scroller first keeps both visible.
  function scrollIntoView() {
    inputRef.current?.scrollIntoView({ block: 'center' });
  }

  return (
    <label className="time-field" htmlFor={id}>
      <span className="time-field-label">
        {label}
        {required ? ' *' : ''}
      </span>
      <input
        ref={inputRef}
        id={id}
        type="date"
        lang="ro-RO"
        autoComplete="off"
        value={value}
        disabled={disabled}
        required={required}
        className={className}
        onFocus={scrollIntoView}
        onClick={scrollIntoView}
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

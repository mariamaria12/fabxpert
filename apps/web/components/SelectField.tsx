'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { computeDropdownPlacement } from './dropdownPlacement';
import {
  FORM_DROPDOWN_CLASS,
  FORM_LABEL_CLASS,
  FORM_SELECT_CLASS,
  formDropdownOptionClass,
} from './formFieldStyles';
import { getBusinessInputAutofillProps } from './inputAutofill';

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
  const listboxId = useId();
  const autofillTrapId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [dropdownStyle, setDropdownStyle] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const emptyLabel = placeholder ?? 'Selectează…';

  const listOptions = useMemo(() => {
    if (allowEmpty) {
      return [{ id: '', label: emptyLabel }, ...options];
    }
    return options;
  }, [allowEmpty, emptyLabel, options]);

  const selectedOption = useMemo(
    () => options.find((option) => option.id === value) ?? null,
    [options, value],
  );

  const displayLabel = selectedOption?.label ?? (allowEmpty ? emptyLabel : '');
  const displayMuted = !selectedOption && allowEmpty;

  const updateDropdownPosition = useCallback(() => {
    if (!triggerRef.current) {
      return;
    }

    setDropdownStyle(computeDropdownPlacement(triggerRef.current));
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    updateDropdownPosition();

    function handleReposition() {
      updateDropdownPosition();
    }

    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);

    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isOpen, updateDropdownPosition, listOptions.length]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) {
        return;
      }
      if (dropdownRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
      setHighlightedId(null);
    }

    document.addEventListener('mousedown', handlePointerDown, true);
    return () => document.removeEventListener('mousedown', handlePointerDown, true);
  }, [isOpen]);

  function openDropdown() {
    if (disabled) {
      return;
    }

    setIsOpen(true);
    updateDropdownPosition();
    setHighlightedId(value || listOptions[0]?.id || null);
  }

  function closeDropdown() {
    setIsOpen(false);
    setHighlightedId(null);
  }

  function selectOption(optionId: string) {
    onChange(optionId);
    closeDropdown();
    triggerRef.current?.focus();
  }

  function moveHighlight(direction: 1 | -1) {
    if (listOptions.length === 0) {
      return;
    }

    const currentIndex = highlightedId
      ? listOptions.findIndex((option) => option.id === highlightedId)
      : -1;

    let nextIndex = currentIndex + direction;
    if (nextIndex < 0) {
      nextIndex = listOptions.length - 1;
    }
    if (nextIndex >= listOptions.length) {
      nextIndex = 0;
    }

    setHighlightedId(listOptions[nextIndex]?.id ?? null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!isOpen) {
        openDropdown();
        return;
      }
      moveHighlight(1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) {
        openDropdown();
        return;
      }
      moveHighlight(-1);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!isOpen) {
        openDropdown();
        return;
      }
      if (highlightedId !== null) {
        selectOption(highlightedId);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeDropdown();
    }
  }

  const dropdown =
    isOpen && dropdownStyle
      ? createPortal(
          <ul
            ref={dropdownRef}
            id={listboxId}
            role="listbox"
            aria-labelledby={`${id}-label`}
            className={FORM_DROPDOWN_CLASS}
            style={{
              top: dropdownStyle.top,
              left: dropdownStyle.left,
              width: dropdownStyle.width,
              maxHeight: dropdownStyle.maxHeight,
            }}
          >
            {listOptions.map((option) => {
              const isHighlighted = option.id === highlightedId;
              const isSelected = value === option.id;
              const isEmptyOption = allowEmpty && option.id === '';

              return (
                <li key={option.id || '__empty__'} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      selectOption(option.id);
                    }}
                    onMouseEnter={() => setHighlightedId(option.id)}
                    className={formDropdownOptionClass(isHighlighted, isSelected)}
                  >
                    <span
                      className={`min-w-0 flex-1 ${isEmptyOption ? 'text-text-secondary' : 'font-medium'}`}
                    >
                      {option.label}
                    </span>
                    {isSelected && (
                      <i className="ti ti-check shrink-0 text-base text-accent" aria-hidden="true" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div ref={containerRef}>
      <label id={`${id}-label`} htmlFor={id} className={FORM_LABEL_CLASS}>
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>

      <div className="relative">
        <button
          ref={triggerRef}
          id={id}
          type="button"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          aria-required={required || undefined}
          disabled={disabled}
          onClick={() => (isOpen ? closeDropdown() : openDropdown())}
          onKeyDown={handleKeyDown}
          className={`${FORM_SELECT_CLASS} text-left disabled:cursor-not-allowed disabled:opacity-60 ${
            displayMuted ? 'text-text-muted' : 'text-text-primary'
          }`}
        >
          {displayLabel}
        </button>

        <input
          type="hidden"
          tabIndex={-1}
          aria-hidden="true"
          value={value}
          readOnly
          {...getBusinessInputAutofillProps(autofillTrapId)}
        />

        <i
          className="ti ti-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-muted"
          aria-hidden="true"
        />
      </div>

      {dropdown}

      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

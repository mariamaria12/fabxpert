import { useId, useMemo } from 'react';

export type CredentialAutoComplete = 'username' | 'email' | 'current-password' | 'new-password';

export const BUSINESS_AUTOFILL_ATTRS = {
  autoComplete: 'new-password',
  autoCorrect: 'off',
  autoCapitalize: 'off',
  spellCheck: false,
} as const;

/** Combobox / filter search inputs — avoid browser history + password-manager prompts. */
export const SEARCH_COMBOBOX_AUTOFILL_ATTRS = {
  autoComplete: 'off',
  autoCorrect: 'off',
  autoCapitalize: 'off',
  spellCheck: false,
  'data-1p-ignore': true,
  'data-lpignore': 'true',
  'data-bwignore': 'true',
  'data-form-type': 'other',
} as const;

export function businessAutofillFieldName(seed: string): string {
  return `field-${seed.replace(/:/g, '')}`;
}

export function getBusinessInputAutofillProps(nameSeed: string) {
  return {
    ...BUSINESS_AUTOFILL_ATTRS,
    name: businessAutofillFieldName(nameSeed),
  };
}

export function getSearchComboboxAutofillProps(nameSeed: string) {
  return {
    ...SEARCH_COMBOBOX_AUTOFILL_ATTRS,
    name: businessAutofillFieldName(`search-${nameSeed}`),
  };
}

export function getCredentialInputAutofillProps(autoComplete: CredentialAutoComplete) {
  return {
    autoComplete,
    autoCorrect: 'off' as const,
    autoCapitalize: 'off' as const,
    spellCheck: false as const,
  };
}

export function isCredentialAutoComplete(
  value: string | undefined,
): value is CredentialAutoComplete {
  return (
    value === 'username' ||
    value === 'email' ||
    value === 'current-password' ||
    value === 'new-password'
  );
}

/** Spread on business inputs (inline fields, textareas) outside TextField. */
export function useBusinessAutofillProps() {
  const seed = useId();
  return useMemo(() => getBusinessInputAutofillProps(seed), [seed]);
}

/**
 * Spread on search bars. Their own name keeps Safari from offering what was
 * typed into a form field that happened to get the same `useId`.
 */
export function useSearchAutofillProps() {
  const seed = useId();
  return useMemo(() => getSearchComboboxAutofillProps(seed), [seed]);
}

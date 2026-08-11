export type CredentialAutoComplete = 'username' | 'email' | 'current-password' | 'new-password';

export const BUSINESS_AUTOFILL_ATTRS = {
  autoComplete: 'new-password',
  autoCorrect: 'off',
  autoCapitalize: 'off',
  spellCheck: false,
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

export function getCredentialInputAutofillProps(autoComplete: CredentialAutoComplete) {
  return {
    autoComplete,
    autoCorrect: 'off' as const,
    autoCapitalize: 'off' as const,
    spellCheck: false as const,
  };
}

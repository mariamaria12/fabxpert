import type { Config } from 'tailwindcss';

/**
 * Colors map to the CSS custom properties in @fabxpert/shared/styles/tokens.css
 * (the single source of truth, with light and dark values). Never hardcode
 * hex values in components — use these utilities.
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    // Status badge utilities are defined as strings in shared — must be scanned or Tailwind drops them.
    '../packages/shared/src/projectStatus.ts',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        sidebar: 'var(--color-sidebar)',
        surface: 'var(--color-surface)',
        'surface-hover': 'var(--color-surface-hover)',
        'surface-active': 'var(--color-surface-active)',
        'surface-raised': 'var(--color-surface-raised)',
        'surface-subtle': 'var(--color-surface-subtle)',
        'surface-sunken': 'var(--color-surface-sunken)',
        'surface-popover': 'var(--color-surface-popover)',
        scrim: 'var(--color-scrim)',
        border: 'var(--color-border)',
        'border-subtle': 'var(--color-border-subtle)',
        'border-strong': 'var(--color-border-strong)',
        divider: 'var(--color-divider)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted': 'var(--color-text-muted)',
        'text-disabled': 'var(--color-text-disabled)',
        'text-on-light': 'var(--color-text-on-light)',
        'text-on-primary': 'var(--color-text-on-primary)',
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          active: 'var(--color-primary-active)',
          bg: 'var(--color-primary-bg)',
          border: 'var(--color-primary-border)',
        },
        // `accent` is the historical name of the brand color; same token as `primary`.
        accent: 'var(--color-primary)',
        'accent-contrast': 'var(--color-text-on-primary)',
        success: {
          DEFAULT: 'var(--color-success)',
          bg: 'var(--color-success-bg)',
          border: 'var(--color-success-border)',
          text: 'var(--color-success-text)',
          // Older names, same tokens.
          tint: 'var(--color-success-bg)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          bg: 'var(--color-warning-bg)',
          border: 'var(--color-warning-border)',
          text: 'var(--color-warning-text)',
        },
        danger: {
          DEFAULT: 'var(--color-danger-text)',
          solid: 'var(--color-danger)',
          bg: 'var(--color-danger-bg)',
          border: 'var(--color-danger-border)',
          text: 'var(--color-danger-text)',
        },
        info: {
          DEFAULT: 'var(--color-info)',
          bg: 'var(--color-info-bg)',
          border: 'var(--color-info-border)',
          text: 'var(--color-info-text)',
        },
        purple: {
          DEFAULT: 'var(--color-purple)',
          bg: 'var(--color-purple-bg)',
          border: 'var(--color-purple-border)',
          text: 'var(--color-purple-text)',
        },
        cyan: {
          DEFAULT: 'var(--color-cyan)',
          bg: 'var(--color-cyan-bg)',
          border: 'var(--color-cyan-border)',
          text: 'var(--color-cyan-text)',
        },
        status: {
          'ciorna': {
            bg: 'var(--status-ciorna-bg)',
            text: 'var(--status-ciorna-text)',
            border: 'var(--status-ciorna-border)',
          },
          'in-ofertare': {
            bg: 'var(--status-in-ofertare-bg)',
            text: 'var(--status-in-ofertare-text)',
            border: 'var(--status-in-ofertare-border)',
          },
          'castigat': {
            bg: 'var(--status-castigat-bg)',
            text: 'var(--status-castigat-text)',
            border: 'var(--status-castigat-border)',
          },
          'in-proiectare': {
            bg: 'var(--status-in-proiectare-bg)',
            text: 'var(--status-in-proiectare-text)',
            border: 'var(--status-in-proiectare-border)',
          },
          'in-productie': {
            bg: 'var(--status-in-productie-bg)',
            text: 'var(--status-in-productie-text)',
            border: 'var(--status-in-productie-border)',
          },
          'pregatit-livrare': {
            bg: 'var(--status-pregatit-livrare-bg)',
            text: 'var(--status-pregatit-livrare-text)',
            border: 'var(--status-pregatit-livrare-border)',
          },
          'livrat': {
            bg: 'var(--status-livrat-bg)',
            text: 'var(--status-livrat-text)',
            border: 'var(--status-livrat-border)',
          },
          'finalizat': {
            bg: 'var(--status-finalizat-bg)',
            text: 'var(--status-finalizat-text)',
            border: 'var(--status-finalizat-border)',
          },
          'suspendat': {
            bg: 'var(--status-suspendat-bg)',
            text: 'var(--status-suspendat-text)',
            border: 'var(--status-suspendat-border)',
          },
          'anulat': {
            bg: 'var(--status-anulat-bg)',
            text: 'var(--status-anulat-text)',
            border: 'var(--status-anulat-border)',
          },
        },
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        raised: 'var(--shadow-raised)',
        modal: 'var(--shadow-modal)',
        popover: 'var(--shadow-popover)',
      },
    },
  },
};

export default config;

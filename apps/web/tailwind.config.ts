import type { Config } from 'tailwindcss';

/**
 * Colors map to CSS custom properties defined in
 * @fabxpert/shared/styles/tokens.css (the single source of truth).
 * Never hardcode hex values in components — use these utilities.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        'surface-raised': 'var(--color-surface-raised)',
        border: 'var(--color-border)',
        'border-subtle': 'var(--color-border-subtle)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted': 'var(--color-text-muted)',
        accent: 'var(--color-accent)',
        'accent-contrast': 'var(--color-accent-contrast)',
        danger: 'var(--color-danger-text)',
        success: 'var(--color-success-icon)',
        status: {
          ciorna: {
            bg: 'var(--status-ciorna-bg)',
            text: 'var(--status-ciorna-text)',
          },
          'in-ofertare': {
            bg: 'var(--status-in-ofertare-bg)',
            text: 'var(--status-in-ofertare-text)',
          },
          castigat: {
            bg: 'var(--status-castigat-bg)',
            text: 'var(--status-castigat-text)',
          },
          'in-proiectare': {
            bg: 'var(--status-in-proiectare-bg)',
            text: 'var(--status-in-proiectare-text)',
          },
          'in-productie': {
            bg: 'var(--status-in-productie-bg)',
            text: 'var(--status-in-productie-text)',
          },
          'pregatit-livrare': {
            bg: 'var(--status-pregatit-livrare-bg)',
            text: 'var(--status-pregatit-livrare-text)',
          },
          livrat: {
            bg: 'var(--status-livrat-bg)',
            text: 'var(--status-livrat-text)',
          },
          finalizat: {
            bg: 'var(--status-finalizat-bg)',
            text: 'var(--status-finalizat-text)',
          },
          suspendat: {
            bg: 'var(--status-suspendat-bg)',
            text: 'var(--status-suspendat-text)',
          },
          anulat: {
            bg: 'var(--status-anulat-bg)',
            text: 'var(--status-anulat-text)',
          },
        },
      },
    },
  },
};

export default config;

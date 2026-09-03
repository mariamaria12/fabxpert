/**
 * The few theme colors that must exist as literals outside CSS: PWA manifests,
 * <meta name="theme-color"> and the native color input. Everything else reads
 * styles/tokens.css; keep these in sync with it.
 */
export const THEME_COLORS = {
  /** --color-bg */
  bg: '#1F1E19',
  /** Neutral swatch shown before a custom color is picked. */
  swatchFallback: '#6B6B6B',
} as const;

import {
  PROJECT_STATUS_META,
  PROJECT_STATUS_VALUES,
  type ProjectStatus,
} from '@fabxpert/shared';
import type { SearchableSelectOption } from '@/components/SearchableSelect';

/** Status chip colors, read from the --status-* tokens in tokens.css. */
export const STATUS_CHIP_COLORS: Record<ProjectStatus, { background: string; text: string }> =
  Object.fromEntries(
    PROJECT_STATUS_VALUES.map((status) => {
      const slug = status.toLowerCase().replaceAll('_', '-');
      return [status, { background: `var(--status-${slug}-bg)`, text: `var(--status-${slug}-text)` }];
    }),
  ) as Record<ProjectStatus, { background: string; text: string }>;

export const STATUS_FILTER_OPTIONS: SearchableSelectOption[] = PROJECT_STATUS_VALUES.map(
  (status) => ({
    id: status,
    label: PROJECT_STATUS_META[status].label,
    color: STATUS_CHIP_COLORS[status].background,
    textColor: STATUS_CHIP_COLORS[status].text,
  }),
);

/** Statuses excluded from Panou "Proiecte în curs" (matches API statusGroup=in_progress). */
const IN_PROGRESS_EXCLUDED = new Set<ProjectStatus>(['FINALIZAT', 'ANULAT']);

export const IN_PROGRESS_STATUS_FILTER_OPTIONS: SearchableSelectOption[] =
  STATUS_FILTER_OPTIONS.filter((option) => !IN_PROGRESS_EXCLUDED.has(option.id as ProjectStatus));

/** Sentinel value for projects with no role restriction ("Vizibil pentru toți"). */
export const VISIBILITY_EVERYONE_VALUE = 'everyone';

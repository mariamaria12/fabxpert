import {
  PROJECT_STATUS_META,
  PROJECT_STATUS_VALUES,
  type ProjectStatus,
} from '@fabxpert/shared';
import type { SearchableSelectOption } from '@/components/SearchableSelect';

/** Chip colors aligned with status badge tokens (tokens.css). */
export const STATUS_CHIP_COLORS: Record<ProjectStatus, string> = {
  CIORNA: '#444441',
  IN_OFERTARE: '#0c447c',
  CASTIGAT: '#085041',
  IN_PROIECTARE: '#3c3489',
  IN_PRODUCTIE: '#633806',
  PREGATIT_LIVRARE: '#712b13',
  LIVRAT: '#27500a',
  FINALIZAT: '#1a4a52',
  SUSPENDAT: '#444441',
  ANULAT: '#791f1f',
};

export const STATUS_FILTER_OPTIONS: SearchableSelectOption[] = PROJECT_STATUS_VALUES.map(
  (status) => ({
    id: status,
    label: PROJECT_STATUS_META[status].label,
    color: STATUS_CHIP_COLORS[status],
  }),
);

/** Statuses excluded from Panou "Proiecte în curs" (matches API statusGroup=in_progress). */
const IN_PROGRESS_EXCLUDED = new Set<ProjectStatus>(['FINALIZAT', 'ANULAT']);

export const IN_PROGRESS_STATUS_FILTER_OPTIONS: SearchableSelectOption[] =
  STATUS_FILTER_OPTIONS.filter((option) => !IN_PROGRESS_EXCLUDED.has(option.id as ProjectStatus));

/** Sentinel value for projects with no role restriction ("Vizibil pentru toți"). */
export const VISIBILITY_EVERYONE_VALUE = 'everyone';

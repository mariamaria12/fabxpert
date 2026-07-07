import { ApiError } from '@fabxpert/shared';

/** Standard toast copy for failed API operations — never surfaces raw API bodies. */
export function apiErrorToastMessage(caught: unknown): string {
  if (caught instanceof ApiError && caught.status === 0) {
    return 'Nu s-a putut contacta serverul.';
  }

  return 'A apărut o eroare.';
}

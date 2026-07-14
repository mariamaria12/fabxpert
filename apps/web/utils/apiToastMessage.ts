import { ApiError } from '@fabxpert/shared';

/** Standard toast copy for failed API operations — never surfaces raw API bodies. */
export function apiErrorToastMessage(caught: unknown): string {
  if (caught instanceof ApiError && caught.status === 0) {
    return 'Nu s-a putut contacta serverul.';
  }

  if (caught instanceof ApiError && caught.status === 403) {
    return 'Acces interzis. Conectează-te cu un cont de administrator.';
  }

  if (caught instanceof ApiError && caught.status === 409 && caught.message) {
    return caught.message;
  }

  return 'A apărut o eroare.';
}

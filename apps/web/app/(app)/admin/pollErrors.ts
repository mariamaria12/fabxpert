import { ApiError } from '@fabxpert/shared';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';

/** The API answers in English; these are the poll conflicts a user can hit. */
const MESSAGES: Record<string, string> = {
  'This poll is already published': 'Sondajul este deja publicat.',
  'This poll is closed': 'Sondajul este închis.',
  'A draft poll cannot be closed': 'Sondajul nu este publicat încă.',
  'Only a closed poll can be reopened': 'Sondajul nu este închis.',
  'A poll needs at least two options before publishing':
    'Sondajul are nevoie de cel puțin două opțiuni.',
  'Options can only be changed while the poll is a draft':
    'Opțiunile nu mai pot fi schimbate după publicare.',
  'Answer mode can only be changed while the poll is a draft':
    'Modul de răspuns nu mai poate fi schimbat după publicare.',
  'This poll is not open for answers': 'Sondajul nu mai acceptă răspunsuri.',
};

export function pollErrorMessage(caught: unknown): string {
  if (caught instanceof ApiError && MESSAGES[caught.message]) {
    return MESSAGES[caught.message];
  }

  if (caught instanceof ApiError && caught.status === 404) {
    return 'Sondajul nu mai există.';
  }

  return apiErrorToastMessage(caught);
}

/** True when the screen is out of step with the server and should refetch. */
export function isStalePollError(caught: unknown): boolean {
  return caught instanceof ApiError && (caught.status === 409 || caught.status === 404);
}

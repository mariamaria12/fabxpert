/**
 * Module-level state for the currently-open impersonation session.
 *
 * Only one impersonation modal is open at a time, so a singleton is enough to
 * bind the copied mobile screens (which call the person-scoped API adapter) to
 * the impersonated person, and to route every mutating action through the
 * admin confirmation dialog — without threading props through every component.
 */

export type ImpersonationActionKind =
  | 'add-pontaj'
  | 'edit-pontaj'
  | 'delete-pontaj'
  | 'add-concediu'
  | 'edit-concediu'
  | 'delete-concediu';

export const IMPERSONATION_CONFIRM_MESSAGES: Record<ImpersonationActionKind, string> = {
  'add-pontaj': 'Sigur vrei să adaugi pontaj?',
  'edit-pontaj': 'Sigur vrei să modifici pontajul?',
  'delete-pontaj': 'Sigur vrei să ștergi pontajul?',
  'add-concediu': 'Sigur vrei să adaugi concediu?',
  'edit-concediu': 'Sigur vrei să modifici concediul?',
  'delete-concediu': 'Sigur vrei să anulezi concediul?',
};

let currentPersonId: string | null = null;
let confirmHandler: ((kind: ImpersonationActionKind) => Promise<boolean>) | null = null;

export function setImpersonationPersonId(personId: string | null): void {
  currentPersonId = personId;
}

export function getImpersonationPersonId(): string {
  if (!currentPersonId) {
    throw new Error('No active impersonation session');
  }
  return currentPersonId;
}

export function setImpersonationConfirmHandler(
  handler: ((kind: ImpersonationActionKind) => Promise<boolean>) | null,
): void {
  confirmHandler = handler;
}

/**
 * Ask the admin to confirm a mutating action. Resolves `true` when confirmed.
 * Falls back to `true` if no dialog is registered (should not happen in practice).
 */
export function requestImpersonationConfirm(
  kind: ImpersonationActionKind,
): Promise<boolean> {
  if (!confirmHandler) {
    return Promise.resolve(true);
  }
  return confirmHandler(kind);
}

import type { MeResponse } from '@fabxpert/shared';

export function getUserInitials(user: MeResponse): string {
  if (user.person) {
    const first = user.person.firstName.trim()[0] ?? '';
    const last = user.person.lastName.trim()[0] ?? '';
    if (first || last) {
      return `${first}${last}`.toUpperCase();
    }
  }

  const local = user.email.split('@')[0] ?? '';
  if (local.length >= 2) {
    return local.slice(0, 2).toUpperCase();
  }

  return (local[0] ?? '?').toUpperCase();
}

export function getUserDisplayName(user: MeResponse): string {
  if (user.person) {
    return `${user.person.firstName} ${user.person.lastName}`.trim();
  }

  return user.email;
}

export function getUserFirstName(user: MeResponse): string {
  const firstName = user.person?.firstName?.trim();
  if (firstName) {
    return firstName;
  }

  const local = user.email.split('@')[0]?.trim();
  return local || user.email;
}

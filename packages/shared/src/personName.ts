export type PersonNameParts = {
  firstName: string;
  lastName: string;
};

/**
 * A person's name as the app writes it everywhere: family name first —
 * "Popescu Ion" — the order of the pontaj documents and of every sorted list.
 */
export function formatPersonName(person: PersonNameParts): string {
  return `${person.lastName} ${person.firstName}`.trim();
}

import type { PersonAccountGroup } from '@fabxpert/shared';

/** Section order and labels shared by the "au pontat" / "nu au pontat" views. */
export const PANOU_PERSON_GROUPS: { group: PersonAccountGroup; title: string }[] = [
  { group: 'employee', title: 'Angajați' },
  { group: 'external', title: 'Externi' },
];

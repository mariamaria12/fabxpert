export const ADMIN_TABS = ['users', 'roles', 'activities'] as const;

export type AdminTab = (typeof ADMIN_TABS)[number];

export const DEFAULT_ADMIN_TAB: AdminTab = 'users';

export function parseAdminTab(value: string | null | undefined): AdminTab {
  if (value === 'roles' || value === 'activities') {
    return value;
  }
  // Legacy Romanian tab slugs
  if (value === 'roluri') {
    return 'roles';
  }
  if (value === 'activitati') {
    return 'activities';
  }
  if (value === 'utilizatori') {
    return 'users';
  }
  return DEFAULT_ADMIN_TAB;
}

export const ADMIN_TAB_ITEMS: {
  id: AdminTab;
  label: string;
  icon: string;
}[] = [
  { id: 'users', label: 'Utilizatori', icon: 'ti-user-shield' },
  { id: 'roles', label: 'Roluri', icon: 'ti-briefcase' },
  { id: 'activities', label: 'Activități', icon: 'ti-tools' },
];

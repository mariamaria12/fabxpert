// Routes are English; visible labels stay Romanian. /concedii uses Romanian path by product choice.

/** Sidebar counters, each fed by its own context. */
export type NavBadgeKey = 'leavePending' | 'overtimePending';

export type NavItem = {
  href: string;
  icon: string;
  label: string;
  badgeKey?: NavBadgeKey;
};

export type NavGroup = {
  /** Group heading, uppercase in the sidebar. */
  label: string;
  items: NavItem[];
};

/** The four everyday screens first; the rest grouped by what they manage. */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: 'Operare',
    items: [
      { href: '/', icon: 'ti-layout-dashboard', label: 'Panou' },
      { href: '/projects', icon: 'ti-clipboard-list', label: 'Proiecte' },
      { href: '/timesheets', icon: 'ti-clock', label: 'Pontaj', badgeKey: 'overtimePending' },
      { href: '/concedii', icon: 'ti-calendar-off', label: 'Concedii', badgeKey: 'leavePending' },
    ],
  },
  {
    label: 'Resurse',
    items: [
      { href: '/people', icon: 'ti-users', label: 'Persoane' },
      { href: '/companies', icon: 'ti-building', label: 'Companii' },
    ],
  },
  {
    label: 'Rapoarte',
    items: [{ href: '/reports', icon: 'ti-report-analytics', label: 'Rapoarte' }],
  },
  {
    label: 'Administrare',
    items: [{ href: '/admin', icon: 'ti-settings', label: 'Administrare' }],
  },
];

export const NAV_ITEMS: readonly NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

/** Whether `pathname` lives under a nav entry — the root only matches itself. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
}

/** Label of the nav entry matching a pathname — same matching rule as the sidebar. */
export function navLabelForPathname(pathname: string): string | null {
  const match = NAV_ITEMS.find((item) => isNavItemActive(item, pathname));
  return match?.label ?? null;
}

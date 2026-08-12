// Routes are English; visible labels stay Romanian. /concedii uses Romanian path by product choice.
export const NAV_ITEMS = [
  { href: '/', icon: 'ti-layout-dashboard', label: 'Panou' },
  { href: '/reports', icon: 'ti-report-analytics', label: 'Rapoarte' },
  { href: '/projects', icon: 'ti-clipboard-list', label: 'Proiecte' },
  { href: '/companies', icon: 'ti-building', label: 'Companii' },
  { href: '/people', icon: 'ti-users', label: 'Persoane' },
  { href: '/timesheets', icon: 'ti-clock', label: 'Pontaje' },
  { href: '/concedii', icon: 'ti-calendar-off', label: 'Concedii', badgeKey: 'leavePending' as const },
  { href: '/admin', icon: 'ti-settings', label: 'Administrare' },
] as const;

/** Label of the nav entry matching a pathname — same matching rule as the sidebar. */
export function navLabelForPathname(pathname: string): string | null {
  const match = NAV_ITEMS.find((item) =>
    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href),
  );
  return match?.label ?? null;
}

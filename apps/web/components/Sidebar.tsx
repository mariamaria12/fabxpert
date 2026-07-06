'use client';

import { logout } from '@fabxpert/shared';
import type { MeResponse } from '@fabxpert/shared';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

// Routes are English; visible labels stay Romanian.
const NAV_ITEMS = [
  { href: '/', icon: 'ti-layout-dashboard', label: 'Panou' },
  { href: '/projects', icon: 'ti-clipboard-list', label: 'Proiecte' },
  { href: '/companies', icon: 'ti-building', label: 'Companii' },
  { href: '/people', icon: 'ti-users', label: 'Persoane' },
  { href: '/timesheets', icon: 'ti-clock', label: 'Pontaje' },
  { href: '/users', icon: 'ti-user-shield', label: 'Utilizatori' },
] as const;

function getInitials(user: MeResponse): string {
  if (user.person) {
    return (user.person.firstName[0] + user.person.lastName[0]).toUpperCase();
  }
  return user.email.slice(0, 2).toUpperCase();
}

interface SidebarProps {
  collapsed: boolean;
  user: MeResponse | null;
  /** Omitted in drawer mode, where the collapse toggle makes no sense. */
  onToggleCollapse?: () => void;
  /** Called on nav clicks — used by the mobile drawer to close itself. */
  onNavigate?: () => void;
  className?: string;
}

export function Sidebar({
  collapsed,
  user,
  onToggleCollapse,
  onNavigate,
  className = '',
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <aside
      className={`${className} flex-col overflow-hidden border-r border-border-subtle bg-surface transition-[width] duration-150 ${
        collapsed ? 'w-14' : 'w-[168px]'
      }`}
    >
      {/* Wordmark + collapse toggle — single row in both states */}
      <div
        className={`flex items-center justify-between py-3 ${
          collapsed ? 'pl-2 pr-1' : 'pl-3 pr-1.5'
        }`}
      >
        <Link
          href="/"
          onClick={onNavigate}
          title="FabXpert"
          className="flex items-baseline font-medium"
        >
          {!collapsed && (
            <span className="text-sm tracking-[0.06em] text-text-primary">FAB</span>
          )}
          <span className={`text-[28px] leading-none text-accent ${collapsed ? '' : '-mx-0.5'}`}>
            X
          </span>
          {!collapsed && (
            <span className="text-sm tracking-[0.06em] text-text-primary">PERT</span>
          )}
        </Link>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            title={collapsed ? 'Extinde meniul' : 'Restrânge meniul'}
            className="flex h-8 w-6 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface-raised hover:text-text-primary"
          >
            <i
              className={`ti text-base ${collapsed ? 'ti-chevron-right' : 'ti-chevron-left'}`}
              aria-hidden="true"
            />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="mt-2 flex flex-col gap-1 px-2">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              onClick={onNavigate}
              className={`flex items-center gap-2.5 rounded-md py-2 text-sm ${
                collapsed ? 'justify-center px-0' : 'px-2.5'
              } ${
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-muted hover:bg-surface-raised hover:text-text-secondary'
              }`}
            >
              <i className={`ti ${item.icon} text-lg`} aria-hidden="true" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User chip */}
      <div
        className={`mt-auto flex border-t border-border-subtle p-3 ${
          collapsed ? 'flex-col items-center gap-2' : 'items-center gap-2'
        }`}
      >
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-contrast"
          title={user?.email}
        >
          {user ? getInitials(user) : '·'}
        </div>
        {!collapsed && user && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-text-secondary" title={user.email}>
              {user.email}
            </p>
            <p className="text-[11px] text-text-muted">{user.role}</p>
          </div>
        )}
        <button
          type="button"
          onClick={handleLogout}
          title="Deconectare"
          className="text-text-muted hover:text-danger"
        >
          <i className={`ti ti-logout ${collapsed ? 'text-base' : 'text-lg'}`} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}

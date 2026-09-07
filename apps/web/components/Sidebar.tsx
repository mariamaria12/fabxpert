'use client';

import { logout } from '@fabxpert/shared';
import type { MeResponse } from '@fabxpert/shared';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { InitialsAvatar, PersonAvatar } from '@/components/PersonAvatar';
import { clearCachedSessionUser } from '@/utils/sessionUserCache';
import { useLeavePendingCount } from '@/context/LeavePendingCountContext';
import { useOvertimePendingCount } from '@/context/OvertimePendingCountContext';
import { isNavItemActive, NAV_GROUPS, type NavBadgeKey } from '@/components/navItems';
import { useTheme } from '@/hooks/useTheme';
import { nextTheme, THEMES } from '@/utils/theme';

function getEmailInitials(email: string): string {
  return email.slice(0, 2).toUpperCase();
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
  const { pendingCount: leavePendingCount } = useLeavePendingCount();
  const { pendingCount: overtimePendingCount } = useOvertimePendingCount();
  const { theme, setTheme } = useTheme();

  const badgeCounts: Record<NavBadgeKey, number> = {
    leavePending: leavePendingCount,
    overtimePending: overtimePendingCount,
  };
  const themeMeta = THEMES.find((item) => item.id === theme) ?? THEMES[0];

  async function handleLogout() {
    clearCachedSessionUser();
    await logout();
    router.replace('/login');
  }

  return (
    <aside
      className={`${className} flex-col overflow-hidden border-r border-border-subtle bg-sidebar transition-[width] duration-150 ${
        collapsed ? 'w-14' : 'w-[200px]'
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
          {!collapsed && <span className="text-sm tracking-[0.06em] text-text-primary">FAB</span>}
          <span className={`text-[28px] leading-none text-accent ${collapsed ? '' : '-mx-0.5'}`}>
            X
          </span>
          {!collapsed && <span className="text-sm tracking-[0.06em] text-text-primary">PERT</span>}
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

      {/* Navigation — grouped; a group heading becomes a hairline when collapsed */}
      <nav className="mt-2 flex flex-col gap-1 overflow-y-auto px-2">
        {NAV_GROUPS.map((group, groupIndex) => (
          <div key={group.label} className={groupIndex === 0 ? '' : 'mt-3'}>
            {collapsed ? (
              groupIndex === 0 ? null : (
                <div className="mx-2 mb-2 border-t border-border-subtle" aria-hidden="true" />
              )
            ) : (
              <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-text-disabled">
                {group.label}
              </p>
            )}
            <div className="flex flex-col gap-1">
              {group.items.map((item) => {
                const isActive = isNavItemActive(item, pathname);
                const count = item.badgeKey ? badgeCounts[item.badgeKey] : 0;
                const badge = count > 0 ? count : null;
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
                        ? 'bg-surface-active text-primary-hover'
                        : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                    }`}
                  >
                    <span className="relative shrink-0">
                      <i
                        className={`ti ${item.icon} text-lg ${isActive ? 'text-primary' : 'text-text-muted'}`}
                        aria-hidden="true"
                      />
                      {collapsed && badge !== null ? (
                        <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-contrast">
                          {badge > 9 ? '9+' : badge}
                        </span>
                      ) : null}
                    </span>
                    {!collapsed && (
                      <>
                        <span className="min-w-0 flex-1">{item.label}</span>
                        {badge !== null ? (
                          <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-contrast">
                            {badge > 99 ? '99+' : badge}
                          </span>
                        ) : null}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Theme switch — cycles through THEMES */}
      <div className={`mt-auto px-2 pb-2 ${collapsed ? 'flex justify-center' : ''}`}>
        <button
          type="button"
          onClick={() => setTheme(nextTheme(theme))}
          title={`Temă: ${themeMeta.label}. Schimbă tema`}
          aria-label={`Temă: ${themeMeta.label}. Schimbă tema`}
          className={`flex items-center gap-2.5 rounded-md py-2 text-sm text-text-muted hover:bg-surface-raised hover:text-text-secondary ${
            collapsed ? 'justify-center px-2' : 'w-full px-2.5'
          }`}
        >
          <i className={`ti ${themeMeta.icon} text-lg`} aria-hidden="true" />
          {!collapsed && (
            <span className="flex min-w-0 flex-1 items-center justify-between">
              <span>Temă</span>
              <span className="text-xs text-text-muted">{themeMeta.label}</span>
            </span>
          )}
        </button>
      </div>

      {/* User chip */}
      <div
        className={`flex border-t border-border-subtle p-3 ${
          collapsed ? 'flex-col items-center gap-2' : 'items-center gap-2'
        }`}
      >
        {user?.person ? (
          <PersonAvatar person={user.person} />
        ) : (
          <InitialsAvatar initials={user ? getEmailInitials(user.email) : '·'} />
        )}
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

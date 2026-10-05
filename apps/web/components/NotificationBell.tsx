'use client';

import type { NotificationDto } from '@fabxpert/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useTasks } from '@/context/TasksContext';
import { taskHref } from '@/utils/taskNavigation';

interface NotificationBellProps {
  collapsed: boolean;
  /** Called when a notification is opened — the mobile drawer closes itself. */
  onNavigate?: () => void;
}

/** "acum 5 min", "acum 2 ore", "ieri", then the date. */
function formatRelativeTime(iso: string): string {
  const then = new Date(iso);
  const minutes = Math.floor((Date.now() - then.getTime()) / 60_000);
  if (minutes < 1) {
    return 'acum';
  }
  if (minutes < 60) {
    return `acum ${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return hours === 1 ? 'acum o oră' : `acum ${hours} ore`;
  }

  const days = Math.floor(hours / 24);
  if (days === 1) {
    return 'ieri';
  }
  if (days < 7) {
    return `acum ${days} zile`;
  }
  return then.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
}

function notificationIcon(notification: NotificationDto): { icon: string; className: string } {
  switch (notification.kind) {
    case 'TASK_COMPLETED':
      return { icon: 'ti-circle-check', className: 'bg-success-bg text-success-text' };
    case 'TASK_COMMENTED':
      return { icon: 'ti-message', className: 'bg-surface-raised text-text-secondary' };
    default:
      return { icon: 'ti-user-check', className: 'bg-info-bg text-info-text' };
  }
}

/** The bell in the sidebar: task notifications for the signed-in admin. */
export function NotificationBell({ collapsed, onNavigate }: NotificationBellProps) {
  const router = useRouter();
  const { notifications, unreadCount, markRead, markAllRead } = useTasks();
  const [open, setOpen] = useState(false);
  /** Where the sidebar ends, measured when the list opens. */
  const [sidebarRight, setSidebarRight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function openNotification(notification: NotificationDto) {
    markRead(notification.id);
    setOpen(false);
    if (notification.taskId) {
      router.push(taskHref({ taskId: notification.taskId }));
      onNavigate?.();
    }
  }

  const label = unreadCount > 0 ? `Notificări, ${unreadCount} necitite` : 'Notificări';

  return (
    <div ref={containerRef} className={collapsed ? 'flex justify-center' : ''}>
      <button
        type="button"
        onClick={() => {
          const sidebar = containerRef.current?.closest('aside');
          setSidebarRight(sidebar?.getBoundingClientRect().right ?? 0);
          setOpen((current) => !current);
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={label}
        title={label}
        className={`flex items-center gap-2.5 rounded-md py-2 text-sm hover:bg-surface-raised hover:text-text-secondary ${
          collapsed ? 'justify-center px-2' : 'w-full px-2.5'
        } ${open ? 'bg-surface-raised text-text-secondary' : 'text-text-muted'}`}
      >
        <span className="relative shrink-0">
          <i className="ti ti-bell text-lg" aria-hidden="true" />
          {collapsed && unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-accent" />
          ) : null}
        </span>
        {!collapsed && (
          <span className="flex min-w-0 flex-1 items-center justify-between">
            <span>Notificări</span>
            {unreadCount > 0 ? (
              <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-contrast">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null}
          </span>
        )}
      </button>

      {open &&
        // In a portal: the sidebar is its own stacking context and clips its
        // overflow, so a list drawn inside it ends up under the page. Beside
        // the sidebar from `sm` up; across the bottom of the screen on phones.
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Notificări"
            style={{ '--bell-left': `${sidebarRight + 8}px` } as CSSProperties}
            className="fixed inset-x-3 bottom-3 z-50 flex max-h-[70dvh] flex-col rounded-lg border border-border bg-surface-popover shadow-popover sm:inset-x-auto sm:bottom-4 sm:left-[var(--bell-left)] sm:w-[360px]"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
              <p className="text-sm font-medium text-text-primary">Notificări</p>
              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-xs text-info-text hover:underline"
                >
                  Marchează toate ca citite
                </button>
              ) : null}
            </div>

            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-text-muted">
                Nicio notificare deocamdată.
              </p>
            ) : (
              <ul className="min-h-0 flex-1 overflow-y-auto py-1">
                {notifications.map((notification) => {
                  const { icon, className } = notificationIcon(notification);
                  const unread = notification.readAt === null;
                  return (
                    <li key={notification.id}>
                      <button
                        type="button"
                        onClick={() => openNotification(notification)}
                        className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-[var(--color-surface-popover-hover)]"
                      >
                        <span
                          className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${className}`}
                        >
                          <i className={`ti ${icon} text-sm`} aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block text-sm ${
                              unread ? 'font-medium text-text-primary' : 'text-text-secondary'
                            }`}
                          >
                            {notification.title}
                          </span>
                          <span className="block truncate text-xs text-text-secondary">
                            {notification.body}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-text-muted">
                            {formatRelativeTime(notification.createdAt)}
                          </span>
                        </span>
                        {unread ? (
                          <span
                            className="mt-2 size-2 shrink-0 rounded-full bg-accent"
                            aria-label="Necitită"
                          />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

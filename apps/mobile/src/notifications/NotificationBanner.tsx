import type { NotificationDto } from '@fabxpert/shared';
import { useNotificationsContext } from './NotificationsContext';

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18 8a6 6 0 10-12 0c0 5-2 6-2 6h16s-2-1-2-6M13.7 20a2 2 0 01-3.4 0"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface NotificationCardProps {
  notification: NotificationDto;
  onDismiss: (id: string) => void;
}

function NotificationCard({ notification, onDismiss }: NotificationCardProps) {
  return (
    <article className="notification-banner" role="status">
      <span className="notification-banner-icon">
        <BellIcon />
      </span>
      <div className="notification-banner-text">
        <p className="notification-banner-title">{notification.title}</p>
        <p className="notification-banner-body">{notification.body}</p>
        {notification.createdByName ? (
          <p className="notification-banner-author">de la {notification.createdByName}</p>
        ) : null}
      </div>
      <button
        type="button"
        className="notification-banner-close"
        aria-label="Închide notificarea"
        onClick={() => onDismiss(notification.id)}
      >
        <CloseIcon />
      </button>
    </article>
  );
}

/** Notifications shown in-app until the user closes each one with the × button. */
export function NotificationBanner() {
  const { notifications, dismiss } = useNotificationsContext();

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="notification-banner-stack">
      {notifications.map((notification) => (
        <NotificationCard
          key={notification.id}
          notification={notification}
          onDismiss={(id) => void dismiss(id)}
        />
      ))}
    </div>
  );
}

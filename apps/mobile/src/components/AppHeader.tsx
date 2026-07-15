import { logout } from '@fabxpert/shared';
import type { MeResponse } from '@fabxpert/shared';
import { useEffect, useRef, useState } from 'react';
import { getUserDisplayName, getUserInitials } from '../utils/userDisplay';

interface AppHeaderProps {
  user: MeResponse;
  onLogout: () => void;
  onWordmarkPress: () => void;
  onOpenLeave?: () => void;
  screenTitle?: string;
  onScreenBack?: () => void;
}

export function AppHeader({
  user,
  onLogout,
  onWordmarkPress,
  onOpenLeave,
  screenTitle,
  onScreenBack,
}: AppHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [menuOpen]);

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
    onLogout();
  }

  return (
    <header className="app-header">
      {screenTitle && onScreenBack ? (
        <div className="app-header-screen-title">
          <button
            type="button"
            className="app-header-back"
            aria-label="Înapoi"
            onClick={onScreenBack}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M15 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <h1 className="app-header-title">{screenTitle}</h1>
        </div>
      ) : (
        <h1 className="app-header-wordmark">
          <button
            type="button"
            className="app-header-wordmark-button"
            aria-label="Înapoi la început"
            onClick={onWordmarkPress}
          >
            <span className="app-header-wordmark-side">FAB</span>
            <span className="app-header-wordmark-x">X</span>
            <span className="app-header-wordmark-side">PERT</span>
          </button>
        </h1>
      )}

      <div className="app-header-menu-wrap" ref={menuRef}>
        <button
          type="button"
          className="app-header-avatar"
          aria-label="Meniu cont"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {getUserInitials(user)}
        </button>

        {menuOpen && (
          <div className="app-header-dropdown" role="menu">
            <p className="app-header-dropdown-name">{getUserDisplayName(user)}</p>
            <p className="app-header-dropdown-email">{user.email}</p>
            {onOpenLeave ? (
              <button
                type="button"
                className="app-header-dropdown-action"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenLeave();
                }}
              >
                <CalendarOffIcon />
                <span>Concediu</span>
              </button>
            ) : null}
            <div className="app-header-dropdown-footer">
              <button
                type="button"
                className="app-header-dropdown-logout"
                role="menuitem"
                onClick={() => void handleLogout()}
              >
                Deconectare
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

function CalendarOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7h16M7 3v4M17 3v4M5 11h14M9 15l6 6M15 15l-6 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

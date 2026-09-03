import { logout } from '@fabxpert/shared';
import type { MeResponse } from '@fabxpert/shared';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { nextTheme, THEMES, type ThemeIcon } from '../utils/theme';
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
  const { theme, setTheme } = useTheme();
  const themeMeta = THEMES.find((item) => item.id === theme) ?? THEMES[0];

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

      <div className="app-header-actions">
        <button
          type="button"
          className="app-header-theme"
          aria-label={`Temă: ${themeMeta.label}. Schimbă tema`}
          title={`Temă: ${themeMeta.label}. Schimbă tema`}
          onClick={() => setTheme(nextTheme(theme))}
        >
          <ThemeIconGlyph icon={themeMeta.icon} />
        </button>

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
      </div>
    </header>
  );
}

/** Tabler moon / sun / palette outlines — the same glyphs the admin sidebar shows. */
function ThemeIconGlyph({ icon }: { icon: ThemeIcon }) {
  const common = {
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {icon === 'moon' && (
        <path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z" {...common} />
      )}
      {icon === 'sun' && (
        <>
          <circle cx="12" cy="12" r="4" {...common} />
          <path
            d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7"
            {...common}
          />
        </>
      )}
      {icon === 'palette' && (
        <>
          <path
            d="M12 21a9 9 0 0 1 0 -18c4.97 0 9 3.582 9 8c0 1.06 -.474 2.078 -1.318 2.828c-.844 .75 -1.989 1.172 -3.182 1.172h-2.5a2 2 0 0 0 -1 3.75a1.3 1.3 0 0 1 -1 2.25"
            {...common}
          />
          <circle cx="8.5" cy="10.5" r="1" {...common} />
          <circle cx="12.5" cy="7.5" r="1" {...common} />
          <circle cx="16.5" cy="10.5" r="1" {...common} />
        </>
      )}
    </svg>
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

'use client';

import type { MeResponse, UserDto } from '@fabxpert/shared';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MobileLookupCacheProvider } from './context/MobileLookupCacheContext';
import { ToastProvider } from './context/ToastContext';
import { TimesheetFlow } from './screens/TimesheetFlow';
import { DEFAULT_THEME } from './utils/theme';
import {
  IMPERSONATION_CONFIRM_MESSAGES,
  setImpersonationConfirmHandler,
  setImpersonationPersonId,
  type ImpersonationActionKind,
} from './impersonationSession';
import './impersonation.css';

interface ImpersonationModalProps {
  user: UserDto;
  onClose: () => void;
}

/** Build the `MeResponse` the mobile screens expect from an admin `UserDto`. */
function buildImpersonatedUser(user: UserDto): MeResponse {
  return {
    id: user.id,
    email: user.email,
    role: 'EMPLOYEE',
    isActive: user.isActive,
    person: {
      id: user.person.id,
      firstName: user.person.firstName,
      lastName: user.person.lastName,
      employeeRole: user.person.employeeRole
        ? { id: '', name: user.person.employeeRole.name }
        : null,
    },
  };
}

type ConfirmState = {
  kind: ImpersonationActionKind;
  resolve: (value: boolean) => void;
} | null;

export function ImpersonationModal({ user, onClose }: ImpersonationModalProps) {
  const [meUser] = useState(() => buildImpersonatedUser(user));
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [ready, setReady] = useState(false);

  // Bind the impersonation session (personId + confirm dialog) before the
  // mobile provider subtree mounts and starts calling the person-scoped API.
  useEffect(() => {
    setImpersonationPersonId(user.personId);
    setImpersonationConfirmHandler(
      (kind) =>
        new Promise<boolean>((resolve) => {
          setConfirmState({ kind, resolve });
        }),
    );
    setReady(true);

    return () => {
      setImpersonationConfirmHandler(null);
      setImpersonationPersonId(null);
    };
  }, [user.personId]);

  // Close on Escape.
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  function resolveConfirm(value: boolean) {
    setConfirmState((current) => {
      current?.resolve(value);
      return null;
    });
  }

  const fullName = `${user.person.firstName} ${user.person.lastName}`.trim();

  const content = (
    <div
      className="imp-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Impersonare ${fullName}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="imp-modal">
        <div className="imp-topbar">
          <div className="imp-topbar-info">
            <span className="imp-topbar-eyebrow">Impersonare utilizator</span>
            <span className="imp-topbar-name">{fullName}</span>
          </div>
          <button
            type="button"
            className="imp-topbar-close"
            aria-label="Închide impersonarea"
            onClick={onClose}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="imp-phone-frame" data-theme={DEFAULT_THEME}>
          {ready ? (
            <ToastProvider>
              <MobileLookupCacheProvider>
                <TimesheetFlow user={meUser} onLogout={onClose} />
              </MobileLookupCacheProvider>
            </ToastProvider>
          ) : null}

          {confirmState ? (
            <div className="imp-confirm-overlay" role="alertdialog" aria-modal="true">
              <div className="imp-confirm-card">
                <p className="imp-confirm-text">
                  {IMPERSONATION_CONFIRM_MESSAGES[confirmState.kind]}
                </p>
                <div className="imp-confirm-actions">
                  <button
                    type="button"
                    className="imp-confirm-yes"
                    onClick={() => resolveConfirm(true)}
                  >
                    Da
                  </button>
                  <button
                    type="button"
                    className="imp-confirm-no"
                    onClick={() => resolveConfirm(false)}
                  >
                    Nu
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(content, document.body);
}

import { useEffect, useState } from 'react';
import { registerPushDevice } from './pushDevice';
import { detectPushSupport, getPermission, type PushSupport } from './pushSupport';

/** Remembers a "Mai târziu" so the sheet doesn't reappear on every app open. */
const DISMISSED_KEY = 'fabxpert.push-prompt-dismissed';

function wasDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    /** Private mode can throw on localStorage — better to ask again than to crash. */
    return false;
  }
}

function rememberDismissal(): void {
  try {
    window.localStorage.setItem(DISMISSED_KEY, '1');
  } catch {
    /** Nothing to do — the sheet will simply show again next time. */
  }
}

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 15V4m0 0L8.5 7.5M12 4l3.5 3.5M5 13v6a1 1 0 001 1h12a1 1 0 001-1v-6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type PromptMode = 'hidden' | 'ask' | 'install';

/**
 * Asks for notification permission once the user is logged in, behind a short
 * explanation — a bare browser prompt that gets denied can't be re-asked.
 *
 * On iPhone Safari the app must first be added to the Home Screen, so those
 * users get install instructions instead.
 */
export function NotificationPermissionPrompt() {
  const [mode, setMode] = useState<PromptMode>('hidden');
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    const support: PushSupport = detectPushSupport();

    if (support === 'supported' && getPermission() === 'granted') {
      /** Already allowed — just make sure the server knows this device. */
      void registerPushDevice().catch(() => undefined);
      return;
    }

    if (wasDismissed()) {
      return;
    }

    if (support === 'supported' && getPermission() === 'default') {
      setMode('ask');
    } else if (support === 'needsInstall') {
      setMode('install');
    }
  }, []);

  async function handleEnable() {
    setIsWorking(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        await registerPushDevice();
      } else {
        /** Denied is permanent in most browsers — don't ask again. */
        rememberDismissal();
      }
    } catch {
      rememberDismissal();
    } finally {
      setIsWorking(false);
      setMode('hidden');
    }
  }

  function handleLater() {
    rememberDismissal();
    setMode('hidden');
  }

  if (mode === 'hidden') {
    return null;
  }

  return (
    <div className="push-prompt-layer" role="dialog" aria-modal="true">
      <div className="push-prompt-sheet">
        {mode === 'ask' ? (
          <>
            <h2 className="push-prompt-title">Îți amintim de pontaj</h2>
            <p className="push-prompt-text">
              Dacă la ora 17:00 nu ai adăugat încă pontajul zilei, îți trimitem o
              notificare pe telefon. Doar atât — nimic altceva.
            </p>
            <button
              type="button"
              className="push-prompt-primary"
              disabled={isWorking}
              onClick={() => void handleEnable()}
            >
              {isWorking ? 'Se activează…' : 'Activează notificările'}
            </button>
            <button type="button" className="push-prompt-secondary" onClick={handleLater}>
              Mai târziu
            </button>
          </>
        ) : (
          <>
            <h2 className="push-prompt-title">Adaugă aplicația pe ecranul principal</h2>
            <p className="push-prompt-text">
              Pe iPhone, notificările merg doar dacă aplicația este instalată. Durează
              câteva secunde:
            </p>
            <ol className="push-prompt-steps">
              <li>
                Apasă butonul <ShareIcon /> <strong>Partajează</strong> din bara Safari.
              </li>
              <li>
                Alege <strong>Adaugă pe ecranul principal</strong>.
              </li>
              <li>Deschide FabXpert Time de pe ecranul principal.</li>
            </ol>
            <button type="button" className="push-prompt-secondary" onClick={handleLater}>
              Am înțeles
            </button>
          </>
        )}
      </div>
    </div>
  );
}

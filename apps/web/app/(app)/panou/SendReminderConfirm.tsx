'use client';

import { sendTimesheetReminder, type NotLoggedPersonRow } from '@fabxpert/shared';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';

/**
 * "Sigur vrei să...?" step before the pontaj reminder goes to a real phone.
 * Same card as the impersonation confirm, so the two read as one product.
 */
export function SendReminderConfirm({
  person,
  onDone,
}: {
  person: NotLoggedPersonRow;
  onDone: () => void;
}) {
  const { showToast } = useToast();
  const [sending, setSending] = useState(false);
  const personName = `${person.firstName} ${person.lastName}`;

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !sending) {
        onDone();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onDone, sending]);

  async function handleSend() {
    if (sending) {
      return;
    }

    setSending(true);
    try {
      const { pushDeviceCount } = await sendTimesheetReminder(person.id);
      if (pushDeviceCount > 0) {
        showToast(`Notificare trimisă către ${personName}`, 'success');
      } else {
        showToast(
          `${personName} nu are notificările activate pe telefon. Mesajul apare în aplicație la următoarea deschidere.`,
          'error',
        );
      }
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setSending(false);
      onDone();
    }
  }

  const content = (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-scrim p-6"
      role="alertdialog"
      aria-modal="true"
      aria-label="Confirmare trimitere notificare"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !sending) {
          onDone();
        }
      }}
    >
      <div className="w-full max-w-[300px] rounded-2xl border border-border bg-surface px-[18px] pb-4 pt-5 shadow-modal">
        <p className="mb-4 text-center text-[15px] font-medium text-text-primary">
          Sigur vrei să trimiți notificarea de pontaj către {personName}?
        </p>
        <div className="flex gap-2.5">
          <button
            type="button"
            disabled={sending}
            onClick={() => void handleSend()}
            className="min-h-11 flex-1 rounded-lg bg-accent px-3 py-[11px] text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {sending ? 'Se trimite…' : 'Da'}
          </button>
          <button
            type="button"
            disabled={sending}
            onClick={onDone}
            className="min-h-11 flex-1 rounded-lg border border-border px-3 py-[11px] text-sm font-medium text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50"
          >
            Nu
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(content, document.body);
}

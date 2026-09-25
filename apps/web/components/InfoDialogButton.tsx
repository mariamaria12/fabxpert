'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Round ⓘ button that sits next to a page title and opens an explanation of
 * how the page works. Closes on Escape, on the backdrop and on the ✕.
 */
export function InfoDialogButton({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    closeRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      trigger?.focus();
    };
  }, [open]);

  const dialog = (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-scrim p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          setOpen(false);
        }
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl border border-border bg-surface shadow-modal">
        <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-4">
          <h2 id={titleId} className="text-lg font-medium text-text-primary">
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Închide"
            title="Închide"
            className="-mr-1 flex size-8 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            <i className="ti ti-x text-lg" aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-5 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={title}
        title={title}
        aria-haspopup="dialog"
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary"
      >
        <i className="ti ti-info-circle text-xl" aria-hidden="true" />
      </button>
      {open && typeof document !== 'undefined' ? createPortal(dialog, document.body) : null}
    </>
  );
}

/** One headed block of an info dialog; each child of `items` is a bullet. */
export function InfoSection({ title, items }: { title: string; items: ReactNode[] }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-text-secondary">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

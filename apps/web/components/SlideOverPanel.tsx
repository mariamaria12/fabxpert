'use client';

import { useEffect, type ReactNode } from 'react';

export interface SlideOverPanelProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** When true, backdrop click and Escape are ignored. */
  disableClose?: boolean;
}

export function SlideOverPanel({
  open,
  title,
  onClose,
  children,
  footer,
  disableClose = false,
}: SlideOverPanelProps) {
  useEffect(() => {
    if (!open || disableClose) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, disableClose, onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Închide panoul"
        className="absolute inset-0 bg-bg/70"
        onClick={disableClose ? undefined : onClose}
        tabIndex={-1}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="slide-over-title"
        className="relative flex h-dvh w-full max-w-md flex-col border-l border-border-subtle bg-surface shadow-xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
          <h2 id="slide-over-title" className="text-base font-medium text-text-primary">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={disableClose}
            aria-label="Închide"
            className="flex size-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <i className="ti ti-x text-lg" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <footer className="shrink-0 border-t border-border-subtle px-5 py-4">{footer}</footer>
        )}
      </div>
    </div>
  );
}

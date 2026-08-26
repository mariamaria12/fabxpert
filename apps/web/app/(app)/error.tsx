'use client';

import { useEffect } from 'react';

/**
 * Without this, a render error unmounts the whole tree and leaves a blank page
 * with nothing to act on. Shows what broke and offers a retry instead.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Eroare de randare:', error);
  }, [error]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <i className="ti ti-alert-triangle text-3xl text-danger" aria-hidden="true" />

      <div className="space-y-1.5">
        <h2 className="text-base font-medium text-text-primary">Ceva nu a mers bine</h2>
        <p className="text-sm text-text-secondary">
          Pagina nu a putut fi afișată. Poți încerca din nou.
        </p>
      </div>

      {error.message && (
        <p className="max-w-xl rounded-md border border-border-subtle bg-[var(--color-toast-error-bg)] px-4 py-3 text-left font-mono text-xs text-danger [overflow-wrap:anywhere]">
          {error.message}
          {error.digest && <span className="block text-text-muted">digest: {error.digest}</span>}
        </p>
      )}

      <button
        type="button"
        onClick={reset}
        className="rounded-md border border-border px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
      >
        Reîncearcă
      </button>
    </div>
  );
}

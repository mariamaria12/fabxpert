'use client';

import { ApiError, getMe, login, logout } from '@fabxpert/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!username.trim() || !password || isSubmitting) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await login(username.trim(), password, rememberMe);
      const me = await getMe();

      if (me.role === 'ADMIN') {
        router.replace('/');
        return;
      }

      // EMPLOYEE accounts are mobile-only (architecture.md, Authorization) — clear the session.
      await logout();
      setError('Acest cont este pentru aplicația mobilă.');
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 0) {
        setError('Nu s-a putut contacta serverul.');
      } else {
        // Generic on purpose — the API doesn't distinguish either (avoids user enumeration).
        setError('Utilizator sau parolă incorecte.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4">
      <div className="w-full max-w-[280px]">
        {/* Wordmark */}
        <div className="flex flex-col items-center">
          <h1 className="flex items-baseline text-[22px] font-medium tracking-[0.06em] text-text-primary">
            <span>FAB</span>
            <span className="-mx-1 text-[52px] leading-none text-accent">X</span>
            <span>PERT</span>
          </h1>
          <div className="mt-2 h-0.5 w-14 bg-accent" aria-hidden="true" />
          <p className="mt-3 text-xs tracking-[0.2em] text-text-muted">
            ADMINISTRARE PRODUCȚIE
          </p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-4">
          <div>
            <label
              htmlFor="username"
              className="mb-1.5 block text-xs text-text-secondary"
            >
              Utilizator
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="nume@fabxpert.ro"
              className="w-full rounded-md border border-border bg-surface-raised px-3 py-[10px] text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-xs text-text-secondary"
            >
              Parolă
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="w-full rounded-md border border-border bg-surface-raised py-[10px] pl-3 pr-11 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Ascunde parola' : 'Arată parola'}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-text-muted hover:text-text-secondary"
              >
                <i
                  className={`ti text-lg ${showPassword ? 'ti-eye-off' : 'ti-eye'}`}
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="size-[18px] cursor-pointer accent-accent"
            />
            Ține-mă minte
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 w-full rounded-md bg-accent py-[11px] text-sm font-medium text-accent-contrast disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Se conectează…' : 'Conectare'}
          </button>

          {error && (
            <p role="alert" className="text-center text-xs text-danger">
              {error}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}

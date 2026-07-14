import { ApiError, getMe, login, logout } from '@fabxpert/shared';
import type { MeResponse } from '@fabxpert/shared';
import { useState } from 'react';
import { getCredentialInputAutofillProps } from './utils/inputAutofill';

interface LoginScreenProps {
  onSuccess: (user: MeResponse) => void;
}

export function LoginScreen({ onSuccess }: LoginScreenProps) {
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

      if (me.role === 'EMPLOYEE' && me.isActive) {
        onSuccess(me);
        return;
      }

      // ADMIN accounts are web-only (architecture.md, Authorization) — clear the session.
      await logout();
      setError('Acest cont este pentru aplicația de administrare.');
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 0) {
        setError('Nu s-a putut contacta serverul.');
      } else {
        setError('Utilizator sau parolă incorecte.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-screen">
      <div className="login-top">
        <div className="login-wordmark-block">
          <h1 className="login-wordmark">
            <span className="login-wordmark-side">FAB</span>
            <span className="login-wordmark-x">X</span>
            <span className="login-wordmark-side">PERT</span>
          </h1>
          <div className="login-wordmark-rule" aria-hidden="true" />
          <p className="login-wordmark-subtitle">PONTAJ</p>
        </div>
      </div>

      <div className="login-sheet">
        <div className="login-sheet-handle" aria-hidden="true" />

        <form className="login-form" onSubmit={handleSubmit}>
          <input
            id="username"
            type="email"
            inputMode="email"
            {...getCredentialInputAutofillProps('username')}
            aria-label="Utilizator"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Utilizator"
            className="login-input"
          />

          <div className="password-field">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              {...getCredentialInputAutofillProps('current-password')}
              aria-label="Parolă"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Parolă"
              className="login-input login-input-with-toggle"
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Ascunde parola' : 'Arată parola'}
            >
              {showPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M10.585 10.587a2 2 0 0 0 2.829 2.828M9.879 9.88a4.5 4.5 0 0 1 6.364 6.364M7.05 7.05C5.027 8.458 3.58 10.568 3 13c1.5 4.5 6 7.5 9 7.5 1.313 0 2.615-.419 3.805-1.245M3 3l18 18"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
                </svg>
              )}
            </button>
          </div>

          <label className="login-remember">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            <span>Ține-mă minte</span>
          </label>

          <button type="submit" className="login-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Se conectează…' : 'Conectare'}
          </button>

          {error && (
            <p role="alert" className="login-error">
              {error}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}

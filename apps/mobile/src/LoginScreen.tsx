import { ApiError, getMe, login, logout } from '@fabxpert/shared';
import type { MeResponse } from '@fabxpert/shared';
import { useState } from 'react';

interface LoginScreenProps {
  onSuccess: (user: MeResponse) => void;
}

export function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
      await login(username.trim(), password);
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
      <div className="login-content">
        <div className="login-wordmark-block">
          <h1 className="login-wordmark">
            <span className="login-wordmark-side">FAB</span>
            <span className="login-wordmark-x">X</span>
            <span className="login-wordmark-side">PERT</span>
          </h1>
          <div className="login-wordmark-rule" aria-hidden="true" />
          <p className="login-wordmark-subtitle">ADMINISTRARE PRODUCȚIE</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="username">Utilizator</label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              inputMode="email"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="nume@fabxpert.ro"
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Parolă</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />
          </div>

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

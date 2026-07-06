import { getMe } from '@fabxpert/shared';
import type { MeResponse } from '@fabxpert/shared';
import { useEffect, useState } from 'react';
import { HomeScreen } from './HomeScreen';
import { LoginScreen } from './LoginScreen';

export default function App() {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    let cancelled = false;

    getMe()
      .then((me) => {
        if (!cancelled && me.role === 'EMPLOYEE' && me.isActive) {
          setUser(me);
        }
      })
      .catch(() => {
        // No valid session — stay on login.
      })
      .finally(() => {
        if (!cancelled) {
          setIsCheckingSession(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (isCheckingSession) {
    return null;
  }

  if (user) {
    return <HomeScreen user={user} onLogout={() => setUser(null)} />;
  }

  return <LoginScreen onSuccess={setUser} />;
}

'use client';

// Minimal authenticated placeholder — replaced by the real dashboard in a later step.

import { getMe, logout } from '@fabxpert/shared';
import type { MeResponse } from '@fabxpert/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function HomePage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    getMe()
      .then((user) => {
        if (!cancelled) {
          setMe(user);
        }
      })
      .catch(() => {
        router.replace('/login');
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  if (!me) {
    return null;
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg px-4">
      <p className="text-sm text-text-primary">Autentificat ca {me.email}</p>
      <button
        type="button"
        onClick={handleLogout}
        className="rounded-md border border-border bg-surface-raised px-4 py-2 text-sm text-text-secondary"
      >
        Deconectare
      </button>
    </main>
  );
}

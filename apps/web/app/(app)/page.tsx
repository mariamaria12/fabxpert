'use client';

// Panou (dashboard) — placeholder until the real overview is built.

import { getMe } from '@fabxpert/shared';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    getMe().catch(() => {
      if (!cancelled) {
        router.replace('/login');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex h-full flex-col">
      <h1 className="text-[22px] font-medium text-text-primary">Panou</h1>
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-text-muted">Prezentare generală — în curând.</p>
      </div>
    </div>
  );
}

'use client';

import { ToastProvider } from '@/context/ToastContext';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

'use client';

import { ToastProvider } from '@/context/ToastContext';
import { LeavePendingCountProvider } from '@/context/LeavePendingCountContext';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <LeavePendingCountProvider>{children}</LeavePendingCountProvider>
    </ToastProvider>
  );
}

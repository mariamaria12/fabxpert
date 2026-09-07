'use client';

import { ToastProvider } from '@/context/ToastContext';
import { LeavePendingCountProvider } from '@/context/LeavePendingCountContext';
import { OvertimePendingCountProvider } from '@/context/OvertimePendingCountContext';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <LeavePendingCountProvider>
        <OvertimePendingCountProvider>{children}</OvertimePendingCountProvider>
      </LeavePendingCountProvider>
    </ToastProvider>
  );
}

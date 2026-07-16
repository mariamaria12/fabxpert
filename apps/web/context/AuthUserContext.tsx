'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { MeResponse } from '@fabxpert/shared';

const AuthUserContext = createContext<MeResponse | null>(null);

export function AuthUserProvider({
  user,
  children,
}: {
  user: MeResponse | null;
  children: ReactNode;
}) {
  return <AuthUserContext.Provider value={user}>{children}</AuthUserContext.Provider>;
}

export function useAuthUser() {
  return useContext(AuthUserContext);
}

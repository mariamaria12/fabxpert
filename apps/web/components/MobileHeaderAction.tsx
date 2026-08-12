'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * The slot inside the phone-only sticky header. `null` on wider screens, where
 * the header (and therefore the slot) is not mounted at all.
 */
const MobileHeaderSlotContext = createContext<HTMLElement | null>(null);

export const MobileHeaderSlotProvider = MobileHeaderSlotContext.Provider;

export function useMobileHeaderSlot(): HTMLElement | null {
  return useContext(MobileHeaderSlotContext);
}

/**
 * Renders its children into the sticky header on phones and in place otherwise,
 * so a page can keep one definition of an action button for both layouts.
 */
export function MobileHeaderAction({ children }: { children: ReactNode }) {
  const slot = useMobileHeaderSlot();
  return slot ? createPortal(children, slot) : <>{children}</>;
}

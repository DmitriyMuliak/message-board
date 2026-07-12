'use client';

import { createContext, useContext, type ReactNode } from 'react';
export interface CurrentUser {
  id: string;
  name: string;
  handle: string;
}

const SessionContext = createContext<CurrentUser | null>(null);

export interface SessionProviderProps {
  currentUser: CurrentUser;
  children: ReactNode;
}

export function SessionProvider({ currentUser, children }: SessionProviderProps) {
  return <SessionContext.Provider value={currentUser}>{children}</SessionContext.Provider>;
}

export function useSession(): CurrentUser {
  const currentUser = useContext(SessionContext);
  if (!currentUser) {
    throw new Error('useSession() must be called within a <SessionProvider>.');
  }
  return currentUser;
}

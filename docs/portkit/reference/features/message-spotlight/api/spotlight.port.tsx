'use client';

import { createContext, useContext, type ReactNode } from 'react';

import type { PinMessageState } from '../model/types';

/** Identical shape to AuthorPort. Every feature owns one of these. */
export interface SpotlightPort {
  pin(input: { messageId: string }): Promise<PinMessageState>;
}

const SpotlightPortContext = createContext<SpotlightPort | null>(null);

export function SpotlightPortProvider({
  value,
  children,
}: {
  value: SpotlightPort;
  children: ReactNode;
}) {
  return <SpotlightPortContext.Provider value={value}>{children}</SpotlightPortContext.Provider>;
}

export function useSpotlightPort(): SpotlightPort {
  const port = useContext(SpotlightPortContext);
  if (!port) {
    throw new Error('useSpotlightPort must be called within a SpotlightPortProvider');
  }
  return port;
}

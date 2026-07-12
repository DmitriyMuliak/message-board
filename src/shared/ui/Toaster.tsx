'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

export interface Toast {
  id: string;
  message: string;
  variant?: 'default' | 'error';
  /** Auto-dismiss after this many ms; `null` to keep until explicitly dismissed. */
  duration?: number | null;
}

export interface ToasterContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
}

const ToasterContext = createContext<ToasterContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToasterContext);
  if (!context) {
    throw new Error('useToast must be called within a ToasterProvider');
  }
  return context;
}

interface ToasterProviderProps {
  children: ReactNode;
}

export function ToasterProvider({ children }: ToasterProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (toast: Omit<Toast, 'id'>): string => {
    const id = crypto.randomUUID();
    const fullToast: Toast = { ...toast, id, duration: toast.duration ?? 3000 };
    setToasts((prev) => [...prev, fullToast]);

    if (fullToast.duration) {
      setTimeout(() => {
        removeToast(id);
      }, fullToast.duration);
    }

    return id;
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  return (
    <ToasterContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <Toaster />
    </ToasterContext.Provider>
  );
}

/**
 * The actual toast rendering surface — hidden in a portal-like position
 * (out of normal flow, top of viewport) with `aria-live="polite"` so screen
 * readers announce arrivals without interrupting. Mounted inside the
 * provider so it's always available.
 */
function Toaster() {
  const { toasts, removeToast } = useToast();

  return (
    <div
      role="region"
      aria-live="polite"
      aria-label="Notifications"
      className="fixed inset-x-0 top-0 z-50 flex max-h-screen flex-col items-end gap-2 pointer-events-none px-4 py-4 sm:px-6 sm:py-6"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'pointer-events-auto flex items-center justify-between gap-4 rounded-none border-2 border-ink px-4 py-3 font-sans text-sm animate-simple-enter',
            toast.variant === 'error' ? 'bg-ink text-paper' : 'bg-ink text-paper',
          )}
        >
          <p className="flex-1">{toast.message}</p>
          <button
            type="button"
            onClick={() => removeToast(toast.id)}
            aria-label="Dismiss notification"
            className="cursor-pointer font-bold text-paper outline-none focus-visible:outline-[2px] focus-visible:outline-offset-1 focus-visible:outline-paper"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

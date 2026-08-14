'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * @public — the shape handed to the `fallback` render prop. Every call site today
 * passes an inline arrow and so needs no name for it, but a named fallback
 * component is the one consumer that does, and this is a `shared/` primitive whose
 * module path is its public API.
 */
export interface ErrorBoundaryFallbackProps {
  error: Error;
  /** Clears the caught error and re-renders `children`. */
  reset: () => void;
}

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: (props: ErrorBoundaryFallbackProps) => ReactNode;
  /**
   * Runs just before the boundary clears its error — both on an explicit
   * `reset()` and on a `resetKeys` change. TanStack Query needs this hook
   * (`useQueryErrorResetBoundary().reset`) or the failed query stays in its
   * error state and re-throws the moment it re-renders.
   */
  onReset?: () => void;
  /** Any change here clears the error — e.g. the user switching filters. */
  resetKeys?: readonly unknown[];
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * A minimal error boundary, because React only offers this as a class component
 * and pulling in `react-error-boundary` for ~40 lines isn't worth a dependency.
 *
 * The reason it exists at all: `useSuspenseQuery`/`useSuspenseInfiniteQuery`
 * default to `throwOnError: true`, so a failed feed fetch never sets
 * `query.isError` — it throws. Without a boundary *here*, it escapes to the
 * route-level `app/(main)/error.tsx`, which replaces the whole page. Catching it
 * next to the list is what keeps the composer and filters on screen and lets
 * RETRY refetch in place.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.error === null) {
      return;
    }
    if (!areKeysEqual(prevProps.resetKeys, this.props.resetKeys)) {
      this.reset();
    }
  }

  reset = () => {
    this.props.onReset?.();
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (error !== null) {
      return this.props.fallback({ error, reset: this.reset });
    }
    return this.props.children;
  }
}

function areKeysEqual(a: readonly unknown[] = [], b: readonly unknown[] = []): boolean {
  return a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
}

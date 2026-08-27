import type { ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react';

import { TestRootProviders } from './TestRootProviders';

/**
 * `render` with the app's root providers already mounted.
 *
 * Root providers are app-wide infrastructure ONLY — a QueryClient, a toast
 * host, a theme. Feature ports are deliberately absent: a kit mounts its own
 * port provider through `wrap()`, which is what keeps one feature's test from
 * silently depending on another feature's wiring.
 */
const customRender = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  render(ui, { wrapper: TestRootProviders, ...options });

export * from '@testing-library/react';
export { customRender };

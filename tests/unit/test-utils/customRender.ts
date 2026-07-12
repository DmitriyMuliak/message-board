import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { TestRootProviders } from './TestRootProviders';

const customRender = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  render(ui, { wrapper: TestRootProviders, ...options });

export * from '@testing-library/react';

export { customRender };

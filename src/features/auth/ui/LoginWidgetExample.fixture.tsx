/**
 * Stands in for a widget owned by another team — a library, a micro-frontend,
 * anything that embeds `LoginForm` without owning its tests. It exists so
 * `LoginWidgetExample.test.tsx` can prove the test kit still drives the form
 * from outside, where `rendererLoginForm` is not available.
 *
 * `.fixture.` rather than a bare `.tsx`: the suffix is what tells ESLint and
 * knip this is test-side code, so it may import the harness and stays out of
 * the production graph.
 */
import { LoginForm } from './LoginForm';

export const LoginWidgetExample = ({ onSuccess }: { onSuccess: () => void }) => {
  return (
    <div>
      <h1>Login Widget Example</h1>
      This widget from external source (team/library/micro frontend)
      <LoginForm onSuccess={onSuccess} />
    </div>
  );
};

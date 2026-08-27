/**
 * @filename: lint-staged.config.js
 * @type {import('lint-staged').Configuration}
 */
import path from 'path';

// `--no-warn-ignored`: lint-staged passes staged paths to eslint explicitly, so a
// path eslint is configured to ignore (reference code under `docs/`) emits an
// "ignored file" warning — which `--max-warnings=0` would turn into a failure.
const buildEslintCommand = (filenames) =>
  `eslint --fix --max-warnings=0 --no-warn-ignored ${filenames.map((f) => `'${path.relative(process.cwd(), f)}'`).join(' ')}`;

const lintStagedConfig = {
  '*.{mjs,js,jsx,ts,tsx}': [buildEslintCommand, 'prettier --write'],
};

export default lintStagedConfig;

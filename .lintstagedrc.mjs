/**
 * @filename: lint-staged.config.js
 * @type {import('lint-staged').Configuration}
 */
import path from 'path';

const buildEslintCommand = (filenames) =>
  `eslint --fix --max-warnings=0 ${filenames.map((f) => `'${path.relative(process.cwd(), f)}'`).join(' ')}`;

const lintStagedConfig = {
  '*.{mjs,js,jsx,ts,tsx}': [buildEslintCommand, 'prettier --write'],
};

// Config Example:
// {
//   '*.{js,jsx,ts,tsx}': [
//     'eslint --max-warnings=0 --fix',
//     'prettier --write'
//   ]
// };
export default lintStagedConfig;

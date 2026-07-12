import { execa } from 'execa';

try {
  // 1. Type Check (Full project context)
  console.log('Checking Typescript types...');
  await execa('tsc', ['--noEmit'], { stdio: 'inherit', preferLocal: true });

  // 2. Lint Staged (Formatting & Linting)
  console.log('Running lint-staged...');
  await execa('npx', ['lint-staged'], { stdio: 'inherit', preferLocal: true });
} catch (err) {
  process.exit(err.exitCode || 1);
}

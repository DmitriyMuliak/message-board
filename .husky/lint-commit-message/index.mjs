import fs from 'node:fs';
import path from 'node:path';
import { logger } from './logger.mjs';
import { SKIP_FLAG_RE } from './constants.mjs';
import { getValidationState } from './validators.mjs';
import { parseCommitMessage, formatCommitMessage } from './formatter.mjs';

const readCommitFile = (filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read commit message file: ${err.message}`);
  }
};

const writeCommitFile = (filePath, message) => {
  try {
    fs.writeFileSync(filePath, message, { encoding: 'utf-8' });
  } catch (err) {
    throw new Error(`Failed to write commit message file: ${err.message}`);
  }
};

const main = () => {
  try {
    const rootDir = process.cwd();
    const commitFilePath = path.join(rootDir, '.git', 'COMMIT_EDITMSG');

    const commitMessageRaw = readCommitFile(commitFilePath);

    const parsed = parseCommitMessage(commitMessageRaw);
    const validation = getValidationState(parsed);

    if (SKIP_FLAG_RE.test(commitMessageRaw)) {
      logger.passWithSkip(validation.isValid ? '' : validation.message);
      process.exitCode = 0;
      return;
    }

    if (!validation.isValid) {
      logger.fail(validation.message);
      process.exit(1);
    }

    const newMessage = formatCommitMessage(parsed);

    writeCommitFile(commitFilePath, newMessage);
    logger.pass();
    logger.info(`New message title: ${newMessage}`);
  } catch (err) {
    logger.fail(err.message);
    process.exit(1);
  }
};

main();

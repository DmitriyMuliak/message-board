import { COLORS, EXAMPLES, COMMIT_TYPES } from './constants.mjs';

export const logger = {
  fail(errors) {
    console.log(
      COLORS.BG_RED,
      'Aborting commit: the commit message does not comply with conventional commits standard.',
      COLORS.RESET,
    );
    console.log(COLORS.GREEN, `\nExamples:\n${EXAMPLES.join('\n')}`, COLORS.RESET);
    console.log('Accepted commit types:', COMMIT_TYPES.join('|'));
    if (errors) {
      console.log('Errors:');
      console.log(errors);
    }
  },
  pass() {
    console.log(COLORS.MAGENTA, 'Your commit message is valid. 🚀🚀🚀', COLORS.RESET);
  },
  passWithSkip(message) {
    if (!message) return this.pass();
    console.log(
      COLORS.YELLOW,
      'Your commit message is not valid but passed because message linting was skipped. Fix ASAP.',
      COLORS.RESET,
    );
    console.log('Commit message linting error:');
    console.log(message);
  },
  info(msg) {
    console.log(COLORS.MAGENTA, msg, COLORS.RESET);
  },
};

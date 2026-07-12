export const COLORS = {
  BG_RED: '\x1b[41m',
  RESET: '\x1b[0m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[38;5;191m',
  MAGENTA: '\x1b[35m',
};

export const EXAMPLES = [
  '123;fix;Commit message',
  '123,222,333;test;Commit message',
  'refactor;Commit message',
  'Commit message --skipMessageCheck',
  'Commit message --skipmessagecheck',
];

export const COMMIT_TYPES = [
  'fix',
  'feat',
  'wip',
  'none',
  'chore',
  'change',
  'update',
  'refactor',
  'feature',
  'doc',
  'infra',
  'add',
  'test',
  'style',
];

export const COMMIT_TYPE_RE = new RegExp(`^(${COMMIT_TYPES.join('|')})$`);
export const JIRA_TAG = 'JIRA_TAG';
export const SKIP_FLAG_RE = /--skipmessagecheck|--skipMessageCheck/;

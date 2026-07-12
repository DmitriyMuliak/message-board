import { JIRA_TAG } from './constants.mjs';

export const parseCommitMessage = (commitMessage) => {
  return commitMessage
    .trim()
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
};

export const formatCommitMessage = (parsed) => {
  if (parsed.length === 2) {
    const [type, ...bodyParts] = parsed;
    const body = bodyParts.join(';').trim();
    return `[${type.trim().toUpperCase()}]: ${body}`;
  }

  const tasks = parsed[0];
  const type = parsed[1];
  const body = parsed.slice(2).join(';').trim();

  const ids = tasks
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const tasksBlock = `(${ids.map((id) => `${JIRA_TAG}-${id}`).join(',')})`;
  const typeBlock = `[${type.trim().toUpperCase()}]`;

  return `${tasksBlock}:${typeBlock}: ${body}`;
};

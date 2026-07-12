import { test } from 'node:test';
import assert from 'node:assert';
import { formatCommitMessage, parseCommitMessage } from './formatter.mjs';

test('parseCommitMessage splits by semicolon and trims', () => {
  const parsed = parseCommitMessage(' 123 ; fix ; hello world ');
  assert.deepStrictEqual(parsed, ['123', 'fix', 'hello world']);
});

test('formatCommitMessage handles 2 arguments', () => {
  const parsed = ['refactor', 'some body text'];
  const formatted = formatCommitMessage(parsed);
  assert.strictEqual(formatted, '[REFACTOR]: some body text');
});

test('formatCommitMessage handles 3 arguments', () => {
  const parsed = ['123', 'fix', 'some body text'];
  const formatted = formatCommitMessage(parsed);
  assert.strictEqual(formatted, '(JIRA_TAG-123):[FIX]: some body text');
});

test('formatCommitMessage handles 3 arguments with multiple tasks', () => {
  const parsed = ['123, 456', 'feat', 'some body text'];
  const formatted = formatCommitMessage(parsed);
  assert.strictEqual(formatted, '(JIRA_TAG-123,JIRA_TAG-456):[FEAT]: some body text');
});

test('formatCommitMessage preserves semicolons in body text', () => {
  const parsed = ['123', 'fix', 'some body text', 'with semicolons', 'and more'];
  const formatted = formatCommitMessage(parsed);
  assert.strictEqual(formatted, '(JIRA_TAG-123):[FIX]: some body text;with semicolons;and more');
});

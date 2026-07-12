import { test } from 'node:test';
import assert from 'node:assert';
import { getValidationState } from './validators.mjs';

test('getValidationState fails on < 2 args', () => {
  const res = getValidationState(['fix']);
  assert.strictEqual(res.isValid, false);
  assert.strictEqual(res.message, 'There are no params divided by ";"');
});

test('getValidationState passes on 2 args with valid commit type', () => {
  const res = getValidationState(['fix', 'message']);
  assert.strictEqual(res.isValid, true);
});

test('getValidationState fails on 2 args with invalid commit type', () => {
  const res = getValidationState(['unknown', 'message']);
  assert.strictEqual(res.isValid, false);
});

test('getValidationState passes on 3 args with valid tasks and type', () => {
  const res = getValidationState(['123', 'fix', 'message']);
  assert.strictEqual(res.isValid, true);
});

test('getValidationState fails on 3 args with invalid tasks', () => {
  const res = getValidationState(['abc', 'fix', 'message']);
  assert.strictEqual(res.isValid, false);
  assert.ok(res.message.includes('Task references are not valid numbers.'));
});

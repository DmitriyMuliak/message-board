import { COMMIT_TYPE_RE, COMMIT_TYPES } from './constants.mjs';

export const validators = {
  taskNumbers(value) {
    const ids = value
      .trim()
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 0) {
      return { isValid: false, message: "You didn't pass task id" };
    }
    const allNumeric = ids.every((id) => !Number.isNaN(Number(id)));
    return {
      isValid: allNumeric,
      message: allNumeric ? '' : 'Task references are not valid numbers.',
    };
  },

  commitType(value) {
    const formatted = value.trim();
    const ok = COMMIT_TYPE_RE.test(formatted);
    return {
      isValid: ok,
      message: ok
        ? ''
        : `You should pass commit type as second argument. Accepted type values: ${COMMIT_TYPES.join(',')}`,
    };
  },
};

export const validateAll = (results) => {
  const failed = results.filter((r) => !r.isValid);
  if (failed.length === 0) return { isValid: true, message: '' };
  const message = failed.map((r, i) => `${i + 1}. ${r.message}`).join('\n');
  return { isValid: false, message };
};

export const getValidationState = (parsed) => {
  if (parsed.length < 2) {
    return { isValid: false, message: 'There are no params divided by ";"' };
  }

  if (parsed.length === 2) {
    const type = parsed[0];
    if (!COMMIT_TYPE_RE.test(type)) {
      return {
        isValid: false,
        message: 'In case of 2 arguments the first one needs to be commit type',
      };
    }
    return validateAll([validators.commitType(type)]);
  }

  const tasks = parsed[0];
  const type = parsed[1];
  return validateAll([validators.taskNumbers(tasks), validators.commitType(type)]);
};

import {
  TASK_DESCRIPTION_MAX_CODE_POINTS,
  TASK_PRIORITY_OPTIONS,
  TASK_TITLE_MAX_CODE_POINTS,
} from './task-creation.constants';
import type { TaskPriorityValidationError, TaskTextValidationError } from './task-creation.models';
import { normalizeTaskText } from './task-text.normalizer';

export function validateTaskTitle(value: string): TaskTextValidationError | undefined {
  const normalizedTitle = normalizeTaskText(value);

  if (normalizedTitle.length === 0) {
    return { kind: 'required', message: 'Title is required.' };
  }

  return validateTaskText(normalizedTitle, TASK_TITLE_MAX_CODE_POINTS, false);
}

export function validateTaskDescription(value: string): TaskTextValidationError | undefined {
  const normalizedDescription = normalizeTaskText(value);

  return validateTaskText(normalizedDescription, TASK_DESCRIPTION_MAX_CODE_POINTS, true);
}

export function validateTaskPriority(value: string): TaskPriorityValidationError | undefined {
  for (const priorityOption of TASK_PRIORITY_OPTIONS) {
    if (priorityOption.value === value) {
      return undefined;
    }
  }

  return { kind: 'priority', message: 'Select a valid priority.' };
}

function validateTaskText(
  value: string,
  maximumCodePoints: number,
  allowLineBreaks: boolean,
): TaskTextValidationError | undefined {
  if (/\p{Surrogate}/u.test(value)) {
    return { kind: 'unicode', message: 'Enter valid Unicode text.' };
  }

  const codePoints = [...value];

  for (const character of codePoints) {
    if (isForbiddenCharacter(character, allowLineBreaks)) {
      return createCharacterValidationError(allowLineBreaks);
    }
  }

  if (codePoints.length > maximumCodePoints) {
    return { kind: 'tooLong', message: `Use no more than ${maximumCodePoints} characters.` };
  }

  return undefined;
}

function isForbiddenCharacter(character: string, allowLineBreaks: boolean): boolean {
  if (!allowLineBreaks) {
    return /[\p{Cc}\p{Zl}\p{Zp}]/u.test(character);
  }

  switch (character) {
    case '\t':
    case '\r':
    case '\n':
      return false;
    default:
      return /\p{Cc}/u.test(character);
  }
}

function createCharacterValidationError(allowLineBreaks: boolean): TaskTextValidationError {
  if (allowLineBreaks) {
    return {
      kind: 'characters',
      message: 'Description contains an unsupported control character.',
    };
  }

  return {
    kind: 'characters',
    message: 'Title must be a single line without control characters.',
  };
}

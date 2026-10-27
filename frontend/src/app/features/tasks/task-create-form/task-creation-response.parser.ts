import { parseTaskSummary } from '../task-summary.parser';
import type { CreatedTask } from './task-creation.models';
import { validateTaskDescription, validateTaskTitle } from './task-creation.validator';
import { normalizeTaskText } from './task-text.normalizer';

export function parseTaskCreationResponse(responseBody: unknown): CreatedTask {
  const taskSummary = parseTaskSummary(responseBody);
  const description = readDescription(responseBody);

  if (taskSummary.isCompleted) {
    throwUnexpectedCreationResponse();
  }

  ensureNormalizedTitle(taskSummary.title);
  ensureNormalizedDescription(description);

  return { ...taskSummary, description };
}

function readDescription(responseBody: unknown): string | null {
  if (responseBody === null) {
    throwUnexpectedCreationResponse();
  }

  if (typeof responseBody !== 'object') {
    throwUnexpectedCreationResponse();
  }

  if (!('description' in responseBody)) {
    throwUnexpectedCreationResponse();
  }

  const description = responseBody.description;

  if (description === null) {
    return null;
  }

  if (typeof description !== 'string') {
    throwUnexpectedCreationResponse();
  }

  return description;
}

function ensureNormalizedTitle(title: string): void {
  if (validateTaskTitle(title) !== undefined) {
    throwUnexpectedCreationResponse();
  }

  if (normalizeTaskText(title) !== title) {
    throwUnexpectedCreationResponse();
  }
}

function ensureNormalizedDescription(description: string | null): void {
  if (description === null) {
    return;
  }

  if (description.length === 0) {
    throwUnexpectedCreationResponse();
  }

  if (normalizeTaskText(description) !== description) {
    throwUnexpectedCreationResponse();
  }

  if (validateTaskDescription(description) !== undefined) {
    throwUnexpectedCreationResponse();
  }
}

function throwUnexpectedCreationResponse(): never {
  throw new Error('Unexpected task creation response.');
}

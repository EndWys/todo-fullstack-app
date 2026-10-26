import type { TaskPriority, TaskSummary } from './task-list.models';

const EMPTY_TASK_ID = '00000000-0000-0000-0000-000000000000';
const TASK_ID_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|\+00:00)$/;

export function parseTaskSummary(taskResponse: unknown): TaskSummary {
  if (!isJsonObject(taskResponse)) {
    throwUnexpectedTaskResponse();
  }

  const id = readTaskId(taskResponse['id']);
  const title = readTaskTitle(taskResponse['title']);
  const priority = readTaskPriority(taskResponse['priority']);
  const isCompleted = readCompletionStatus(taskResponse['isCompleted']);
  const createdAt = readUtcTimestamp(taskResponse['createdAt']);
  const completedAt = readCompletionTime(taskResponse['completedAt']);

  ensureConsistentCompletionStatus(isCompleted, completedAt);

  return { id, title, priority, isCompleted, createdAt, completedAt };
}

function readTaskId(value: unknown): string {
  if (typeof value !== 'string') {
    throwUnexpectedTaskResponse();
  }

  if (!TASK_ID_PATTERN.test(value)) {
    throwUnexpectedTaskResponse();
  }

  if (value === EMPTY_TASK_ID) {
    throwUnexpectedTaskResponse();
  }

  return value;
}

function readTaskTitle(value: unknown): string {
  if (typeof value !== 'string') {
    throwUnexpectedTaskResponse();
  }

  return value;
}

function readTaskPriority(value: unknown): TaskPriority {
  switch (value) {
    case 'low':
    case 'normal':
    case 'high':
      return value;
    default:
      throwUnexpectedTaskResponse();
  }
}

function readCompletionStatus(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throwUnexpectedTaskResponse();
  }

  return value;
}

function readUtcTimestamp(value: unknown): string {
  if (typeof value !== 'string') {
    throwUnexpectedTaskResponse();
  }

  if (!UTC_TIMESTAMP_PATTERN.test(value)) {
    throwUnexpectedTaskResponse();
  }

  if (!Number.isFinite(Date.parse(value))) {
    throwUnexpectedTaskResponse();
  }

  return value;
}

function readCompletionTime(value: unknown): string | null {
  if (value === null) {
    return null;
  }

  return readUtcTimestamp(value);
}

function ensureConsistentCompletionStatus(isCompleted: boolean, completedAt: string | null): void {
  const hasCompletionTime = completedAt !== null;

  if (isCompleted !== hasCompletionTime) {
    throwUnexpectedTaskResponse();
  }
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  if (value === null) {
    return false;
  }

  if (typeof value !== 'object') {
    return false;
  }

  return !Array.isArray(value);
}

function throwUnexpectedTaskResponse(): never {
  throw new Error('Unexpected task response.');
}

import { parseTaskSummary } from '../task-summary.parser';
import type { TaskListPageData, TaskSummary } from '../task-list.models';
import { FIRST_TASK_PAGE, SUPPORTED_TASK_PAGE_SIZES } from '../task-list-pagination.constants';

const MAX_INT32 = 2_147_483_647;

export function parseTaskListResponse(responseBody: unknown): TaskListPageData {
  if (!isJsonObject(responseBody)) {
    throwUnexpectedTasksResponse();
  }

  const taskResponses = responseBody['items'];
  if (!Array.isArray(taskResponses)) {
    throwUnexpectedTasksResponse();
  }

  const totalCount = readInt32AtLeast(responseBody['totalCount'], 0);
  const page = readInt32AtLeast(responseBody['page'], FIRST_TASK_PAGE);
  const pageSize = readPageSize(responseBody['pageSize']);

  if (taskResponses.length > pageSize) {
    throwUnexpectedTasksResponse();
  }

  const taskSummaries = taskResponses.map(parseTaskSummary);
  ensureUniqueTaskIdentifiers(taskSummaries);

  // Copy only the public DTO. Do not assume count/items form a transactional snapshot.
  return {
    tasks: taskSummaries,
    totalCount,
    page,
    pageSize,
  };
}

function isJsonObject(candidateValue: unknown): candidateValue is Record<string, unknown> {
  if (candidateValue === null) {
    return false;
  }

  if (typeof candidateValue !== 'object') {
    return false;
  }

  return !Array.isArray(candidateValue);
}

function readInt32AtLeast(candidateValue: unknown, minimumValue: number): number {
  if (typeof candidateValue !== 'number') {
    throwUnexpectedTasksResponse();
  }

  if (!Number.isInteger(candidateValue)) {
    throwUnexpectedTasksResponse();
  }

  if (candidateValue < minimumValue || candidateValue > MAX_INT32) {
    throwUnexpectedTasksResponse();
  }

  return candidateValue;
}

function readPageSize(candidateValue: unknown): (typeof SUPPORTED_TASK_PAGE_SIZES)[number] {
  for (const pageSize of SUPPORTED_TASK_PAGE_SIZES) {
    if (candidateValue === pageSize) {
      return pageSize;
    }
  }

  throwUnexpectedTasksResponse();
}

function ensureUniqueTaskIdentifiers(taskSummaries: readonly TaskSummary[]): void {
  const normalizedTaskIdentifiers = taskSummaries.map((taskSummary) =>
    taskSummary.id.toLowerCase(),
  );
  const uniqueTaskIdentifiers = new Set(normalizedTaskIdentifiers);

  if (uniqueTaskIdentifiers.size !== taskSummaries.length) {
    throw new Error('Unexpected duplicate task identifier.');
  }
}

function throwUnexpectedTasksResponse(): never {
  throw new Error('Unexpected tasks response.');
}

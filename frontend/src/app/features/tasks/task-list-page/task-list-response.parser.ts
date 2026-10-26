import { TaskListPageData, TaskSummary } from '../task-list.models';
import { FIRST_TASK_PAGE, SUPPORTED_TASK_PAGE_SIZES } from '../task-list-pagination.constants';

const MAX_INT32 = 2_147_483_647;
const EMPTY_TASK_ID = '00000000-0000-0000-0000-000000000000';
const TASK_ID_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|\+00:00)$/;

export function parseTaskListResponse(responseBody: unknown): TaskListPageData {
  if (
    !isJsonObject(responseBody) ||
    !Array.isArray(responseBody['items']) ||
    !isInt32AtLeast(responseBody['totalCount'], 0) ||
    !isInt32AtLeast(responseBody['page'], FIRST_TASK_PAGE) ||
    !isSupportedPageSize(responseBody['pageSize']) ||
    responseBody['items'].length > responseBody['pageSize']
  )
    throw new Error('Unexpected tasks response.');

  const taskSummaries = responseBody['items'].map(parseTaskSummary);
  if (
    new Set(taskSummaries.map((taskSummary) => taskSummary.id.toLowerCase())).size !==
    taskSummaries.length
  )
    throw new Error('Unexpected duplicate task identifier.');

  // Copy only the public DTO. Do not assume count/items form a transactional snapshot.
  return {
    tasks: taskSummaries,
    totalCount: responseBody['totalCount'],
    page: responseBody['page'],
    pageSize: responseBody['pageSize'],
  };
}

function parseTaskSummary(taskResponse: unknown): TaskSummary {
  if (
    !isJsonObject(taskResponse) ||
    typeof taskResponse['id'] !== 'string' ||
    !TASK_ID_PATTERN.test(taskResponse['id']) ||
    taskResponse['id'] === EMPTY_TASK_ID ||
    typeof taskResponse['title'] !== 'string' ||
    (taskResponse['priority'] !== 'low' &&
      taskResponse['priority'] !== 'normal' &&
      taskResponse['priority'] !== 'high') ||
    typeof taskResponse['isCompleted'] !== 'boolean' ||
    !isUtcTimestampString(taskResponse['createdAt']) ||
    (taskResponse['completedAt'] !== null && !isUtcTimestampString(taskResponse['completedAt'])) ||
    taskResponse['isCompleted'] !== (taskResponse['completedAt'] !== null)
  )
    throw new Error('Unexpected task response.');

  return {
    id: taskResponse['id'],
    title: taskResponse['title'],
    priority: taskResponse['priority'],
    isCompleted: taskResponse['isCompleted'],
    createdAt: taskResponse['createdAt'],
    completedAt: taskResponse['completedAt'],
  };
}

function isJsonObject(candidateValue: unknown): candidateValue is Record<string, unknown> {
  return (
    typeof candidateValue === 'object' && candidateValue !== null && !Array.isArray(candidateValue)
  );
}

function isInt32AtLeast(candidateValue: unknown, minimumValue: number): candidateValue is number {
  return (
    typeof candidateValue === 'number' &&
    Number.isInteger(candidateValue) &&
    candidateValue >= minimumValue &&
    candidateValue <= MAX_INT32
  );
}

function isSupportedPageSize(
  candidateValue: unknown,
): candidateValue is (typeof SUPPORTED_TASK_PAGE_SIZES)[number] {
  return SUPPORTED_TASK_PAGE_SIZES.some((pageSize) => candidateValue === pageSize);
}

function isUtcTimestampString(candidateValue: unknown): candidateValue is string {
  return (
    typeof candidateValue === 'string' &&
    UTC_TIMESTAMP_PATTERN.test(candidateValue) &&
    Number.isFinite(Date.parse(candidateValue))
  );
}

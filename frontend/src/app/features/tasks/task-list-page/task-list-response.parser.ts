import { parseTaskSummary } from '../task-summary.parser';
import { TaskListPageData } from '../task-list.models';
import { FIRST_TASK_PAGE, SUPPORTED_TASK_PAGE_SIZES } from '../task-list-pagination.constants';

const MAX_INT32 = 2_147_483_647;

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

import { TaskListPageData, TaskSummary } from '../task-list.models';
import { DEFAULT_TASK_PAGE_SIZE, FIRST_TASK_PAGE } from '../task-list-pagination.constants';

interface TaskListHttpResponseTestData {
  readonly items: readonly TaskSummary[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
}

export const sampleTaskSummary: TaskSummary = {
  id: '11111111-1111-1111-1111-111111111111',
  title: 'Learn Angular 😀',
  priority: 'normal',
  isCompleted: false,
  createdAt: '2026-10-22T12:30:00.1234567+00:00',
  completedAt: null,
};

export function createTaskListPageTestData(
  taskSummaries: readonly TaskSummary[] = [sampleTaskSummary],
  totalTaskCount = taskSummaries.length,
): TaskListPageData {
  return {
    tasks: taskSummaries,
    totalCount: totalTaskCount,
    page: FIRST_TASK_PAGE,
    pageSize: DEFAULT_TASK_PAGE_SIZE,
  };
}

export function createTaskListHttpResponseTestData(
  taskSummaries: readonly TaskSummary[] = [sampleTaskSummary],
  totalTaskCount = taskSummaries.length,
): TaskListHttpResponseTestData {
  return {
    items: taskSummaries,
    totalCount: totalTaskCount,
    page: FIRST_TASK_PAGE,
    pageSize: DEFAULT_TASK_PAGE_SIZE,
  };
}

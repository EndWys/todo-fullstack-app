import type { SUPPORTED_TASK_PAGE_SIZES } from './task-list-pagination.constants';

export type TaskPriority = 'low' | 'normal' | 'high';

export type TaskPageSize = (typeof SUPPORTED_TASK_PAGE_SIZES)[number];

export interface TaskListPagination {
  readonly page: number;
  readonly pageSize: TaskPageSize;
}

export type TaskListPaginationState =
  | { readonly status: 'valid'; readonly pagination: TaskListPagination }
  | { readonly status: 'invalid'; readonly message: string };

export interface TaskSummary {
  readonly id: string;
  readonly title: string;
  readonly priority: TaskPriority;
  readonly isCompleted: boolean;
  readonly createdAt: string;
  readonly completedAt: string | null;
}

export interface TaskListPageData {
  readonly tasks: readonly TaskSummary[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: TaskPageSize;
}

export type TaskListLoadState =
  | { readonly status: 'idle' | 'loading' | 'error' }
  | { readonly status: 'ready'; readonly pageData: TaskListPageData };

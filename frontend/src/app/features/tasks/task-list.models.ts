export type TaskPriority = 'low' | 'normal' | 'high';

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
  readonly pageSize: number;
}

export type TaskListLoadState =
  | { readonly status: 'idle' | 'loading' | 'error' }
  | { readonly status: 'ready'; readonly pageData: TaskListPageData };

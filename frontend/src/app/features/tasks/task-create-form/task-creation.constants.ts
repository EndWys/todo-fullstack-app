import type { TaskPriority } from '../task-list.models';

export const TASK_TITLE_MAX_CODE_POINTS = 200;
export const TASK_DESCRIPTION_MAX_CODE_POINTS = 2000;

export const DEFAULT_TASK_PRIORITY: TaskPriority = 'normal';

export const TASK_PRIORITY_OPTIONS: readonly {
  readonly value: TaskPriority;
  readonly label: string;
}[] = [
  { value: 'low', label: 'Low' },
  { value: DEFAULT_TASK_PRIORITY, label: 'Normal' },
  { value: 'high', label: 'High' },
];

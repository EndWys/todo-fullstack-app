import type { TaskPriority, TaskSummary } from '../task-list.models';

export interface TaskCreationFormValue {
  title: string;
  description: string;
  priority: TaskPriority;
}

export interface CreateTaskRequest {
  readonly title: string;
  readonly description: string | null;
  readonly priority: TaskPriority;
}

export interface CreatedTask extends TaskSummary {
  readonly description: string | null;
}

export interface TaskCreationFieldError {
  readonly field: keyof TaskCreationFormValue;
  readonly message: string;
}

export type TaskCreationFailure =
  | { readonly kind: 'validation'; readonly errors: readonly TaskCreationFieldError[] }
  | { readonly kind: 'csrf' | 'session' | 'unconfirmed' };

export interface TaskTextValidationError {
  readonly kind: 'required' | 'tooLong' | 'unicode' | 'characters';
  readonly message: string;
}

export interface TaskPriorityValidationError {
  readonly kind: 'priority';
  readonly message: string;
}

export interface TaskCreationSessionContext {
  readonly sessionRevision: number;
  readonly ownerId: string | undefined;
}

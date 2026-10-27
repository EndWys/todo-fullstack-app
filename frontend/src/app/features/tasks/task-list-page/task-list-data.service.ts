import { httpResource, HttpResourceRequest, HttpStatusCode } from '@angular/common/http';
import { computed, inject, Service, signal } from '@angular/core';
import { AuthSessionService } from '../../auth/auth-session.service';
import { parseTaskListResponse } from './task-list-response.parser';
import type { TaskListLoadState, TaskListPagination } from '../task-list.models';
import { DEFAULT_TASK_PAGE_SIZE, FIRST_TASK_PAGE } from '../task-list-pagination.constants';

const TASK_LIST_REQUEST_TIMEOUT_MS = 15_000;

// A separate read model for each Tasks page, not a singleton cache shared across accounts.
@Service({ autoProvided: false })
export class TaskListDataService {
  private readonly authSession = inject(AuthSessionService);
  private readonly requestedPagination = signal<TaskListPagination | undefined>({
    page: FIRST_TASK_PAGE,
    pageSize: DEFAULT_TASK_PAGE_SIZE,
  });
  private readonly taskListResource = httpResource(() => this.getAuthenticatedTaskListRequest(), {
    parse: parseTaskListResponse,
  });

  readonly taskListLoadState = computed<TaskListLoadState>(() => this.getTaskListLoadState());

  setPagination(pagination: TaskListPagination | undefined): void {
    const currentPagination = this.requestedPagination();
    if (
      currentPagination?.page === pagination?.page &&
      currentPagination?.pageSize === pagination?.pageSize
    ) {
      return;
    }

    this.requestedPagination.set(pagination);

    if (!pagination) {
      // Explicitly abort a pending GET: the installed resource implementation skips
      // its loader on an undefined request without aborting the previous load.
      this.taskListResource.set(undefined);
    }
  }

  reloadTaskList(): void {
    if (!this.authSession.authenticatedUser()) {
      return;
    }

    if (this.taskListResource.isLoading()) {
      return;
    }

    this.taskListResource.reload();
  }

  refreshCurrentPage(): void {
    // A new request reference invalidates even an in-flight pre-mutation read.
    // Do not add a client-only revision as an unsupported HTTP query parameter.
    if (!this.authSession.authenticatedUser()) {
      return;
    }

    const pagination = this.requestedPagination();
    if (!pagination) {
      return;
    }

    this.requestedPagination.set({ ...pagination });
  }

  private getAuthenticatedTaskListRequest(): HttpResourceRequest | undefined {
    if (!this.authSession.authenticatedUser()) {
      return undefined;
    }

    const pagination = this.requestedPagination();
    if (!pagination) {
      return undefined;
    }

    return {
      url: '/api/tasks',
      params: { page: pagination.page, pageSize: pagination.pageSize },
      timeout: TASK_LIST_REQUEST_TIMEOUT_MS,
      cache: 'no-store',
    };
  }

  private getTaskListLoadState(): TaskListLoadState {
    // Hide the previous user's data immediately, even before resource cancellation runs.
    if (!this.authSession.authenticatedUser()) {
      return { status: 'idle' };
    }

    const pagination = this.requestedPagination();
    if (!pagination) {
      return { status: 'idle' };
    }

    if (this.taskListResource.isLoading()) {
      return { status: 'loading' };
    }

    if (this.taskListResource.error()) {
      return { status: 'error' };
    }

    if (!this.taskListResource.hasValue()) {
      return { status: 'loading' };
    }

    if (this.taskListResource.statusCode() !== HttpStatusCode.Ok) {
      return { status: 'error' };
    }

    const pageData = this.taskListResource.value();
    if (pageData.page !== pagination.page || pageData.pageSize !== pagination.pageSize) {
      return { status: 'error' };
    }

    return { status: 'ready', pageData };
  }
}

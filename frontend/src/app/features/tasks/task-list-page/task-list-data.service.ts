import { httpResource, HttpResourceRequest, HttpStatusCode } from '@angular/common/http';
import { computed, inject, Service, signal } from '@angular/core';
import { AuthSessionService } from '../../auth/auth-session.service';
import { parseTaskListResponse } from './task-list-response.parser';
import { TaskListLoadState } from '../task-list.models';
import { DEFAULT_TASK_PAGE_SIZE, FIRST_TASK_PAGE } from '../task-list-pagination.constants';

const TASK_LIST_REQUEST_TIMEOUT_MS = 15_000;

const INITIAL_TASK_LIST_REQUEST: HttpResourceRequest = {
  url: '/api/tasks',
  params: { page: FIRST_TASK_PAGE, pageSize: DEFAULT_TASK_PAGE_SIZE },
  timeout: TASK_LIST_REQUEST_TIMEOUT_MS,
  cache: 'no-store',
};

// A separate read model for each Tasks page, not a singleton cache shared across accounts.
@Service({ autoProvided: false })
export class TaskListDataService {
  private readonly authSession = inject(AuthSessionService);
  private readonly taskListRequest = signal(INITIAL_TASK_LIST_REQUEST);
  private readonly taskListResource = httpResource(
    () => (this.authSession.authenticatedUser() ? this.taskListRequest() : undefined),
    {
      parse: (responseBody: unknown) => {
        const parsedPageData = parseTaskListResponse(responseBody);
        if (
          parsedPageData.page !== FIRST_TASK_PAGE ||
          parsedPageData.pageSize !== DEFAULT_TASK_PAGE_SIZE
        )
          throw new Error('Unexpected tasks page.');
        return parsedPageData;
      },
    },
  );

  readonly taskListLoadState = computed<TaskListLoadState>(() => {
    // Hide the previous user's data immediately, even before resource cancellation runs.
    if (!this.authSession.authenticatedUser()) return { status: 'idle' };
    if (this.taskListResource.isLoading()) return { status: 'loading' };
    if (this.taskListResource.error()) return { status: 'error' };
    if (this.taskListResource.hasValue()) {
      return this.taskListResource.statusCode() === HttpStatusCode.Ok
        ? { status: 'ready', pageData: this.taskListResource.value() }
        : { status: 'error' };
    }
    return { status: 'loading' };
  });

  reloadTaskList(): void {
    if (this.authSession.authenticatedUser() && !this.taskListResource.isLoading())
      this.taskListResource.reload();
  }

  refreshAfterTaskCreation(): void {
    // A new request reference invalidates even an in-flight pre-mutation read.
    // Do not add a client-only revision as an unsupported HTTP query parameter.
    if (!this.authSession.authenticatedUser()) {
      return;
    }

    this.taskListRequest.set({ ...INITIAL_TASK_LIST_REQUEST });
  }
}

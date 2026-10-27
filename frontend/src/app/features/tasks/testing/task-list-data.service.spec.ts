import { ApplicationRef, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthSessionService } from '../../auth/auth-session.service';
import { TaskListDataService } from '../task-list-page/task-list-data.service';

describe('Task list request pagination', () => {
  let taskListDataService: TaskListDataService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        TaskListDataService,
        {
          provide: AuthSessionService,
          useValue: { authenticatedUser: signal({ id: 'user-id', email: 'user@example.com' }) },
        },
      ],
    });
    httpTestingController = TestBed.inject(HttpTestingController);
    taskListDataService = TestBed.inject(TaskListDataService);
  });

  afterEach(() => httpTestingController.verify());

  async function expectTaskListRequest(page = 1, pageSize = 20): Promise<TestRequest> {
    let taskListRequest: TestRequest | undefined;
    await vi.waitFor(() => {
      taskListRequest = httpTestingController.expectOne(
        `/api/tasks?page=${page}&pageSize=${pageSize}`,
      );
    });
    return taskListRequest!;
  }

  it('requests the default page and accepts matching response metadata', async () => {
    const taskListRequest = await expectTaskListRequest();
    expect(taskListRequest.request.timeout).toBe(15_000);
    expect(taskListRequest.request.cache).toBe('no-store');
    taskListRequest.flush({ items: [], totalCount: 0, page: 1, pageSize: 20 });
    await TestBed.inject(ApplicationRef).whenStable();

    expect(taskListDataService.taskListLoadState()).toEqual({
      status: 'ready',
      pageData: { tasks: [], totalCount: 0, page: 1, pageSize: 20 },
    });
  });

  it.each([{ page: 2 }, { pageSize: 10 }, { pageSize: 50 }])(
    'rejects response metadata that differs from the request: %j',
    async (metadataOverrides) => {
      (await expectTaskListRequest()).flush({
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 20,
        ...metadataOverrides,
      });
      await TestBed.inject(ApplicationRef).whenStable();

      expect(taskListDataService.taskListLoadState().status).toBe('error');
    },
  );

  it('still rejects a non-200 success status', async () => {
    (await expectTaskListRequest()).flush(
      { items: [], totalCount: 0, page: 1, pageSize: 20 },
      { status: 201, statusText: 'Created' },
    );
    await TestBed.inject(ApplicationRef).whenStable();

    expect(taskListDataService.taskListLoadState().status).toBe('error');
  });

  it('loads the selected page without an initial default-page request', async () => {
    taskListDataService.setPagination({ page: 3, pageSize: 10 });
    const request = await expectTaskListRequest(3, 10);
    httpTestingController.expectNone('/api/tasks?page=1&pageSize=20');
    request.flush({ items: [], totalCount: 21, page: 3, pageSize: 10 });
    await TestBed.inject(ApplicationRef).whenStable();
    expect(taskListDataService.taskListLoadState()).toEqual({
      status: 'ready',
      pageData: { tasks: [], totalCount: 21, page: 3, pageSize: 10 },
    });
  });

  it('cancels an older page request and publishes only the latest page', async () => {
    const oldRequest = await expectTaskListRequest();
    taskListDataService.setPagination({ page: 2, pageSize: 50 });
    const latestRequest = await expectTaskListRequest(2, 50);
    expect(oldRequest.cancelled).toBe(true);
    expect(() => oldRequest.flush({ items: [], totalCount: 0, page: 1, pageSize: 20 })).toThrow();
    latestRequest.flush({ items: [], totalCount: 60, page: 2, pageSize: 50 });
    await TestBed.inject(ApplicationRef).whenStable();
    expect(taskListDataService.taskListLoadState()).toEqual({
      status: 'ready',
      pageData: { tasks: [], totalCount: 60, page: 2, pageSize: 50 },
    });
  });

  it('rejects wrong response metadata for a non-default request', async () => {
    taskListDataService.setPagination({ page: 2, pageSize: 10 });
    (await expectTaskListRequest(2, 10)).flush({ items: [], totalCount: 0, page: 1, pageSize: 20 });
    await TestBed.inject(ApplicationRef).whenStable();
    expect(taskListDataService.taskListLoadState().status).toBe('error');
  });

  it('does not refetch an unchanged selection', async () => {
    (await expectTaskListRequest()).flush({ items: [], totalCount: 0, page: 1, pageSize: 20 });
    await TestBed.inject(ApplicationRef).whenStable();
    taskListDataService.setPagination({ page: 1, pageSize: 20 });
    await TestBed.inject(ApplicationRef).whenStable();
    httpTestingController.expectNone((request) => request.url === '/api/tasks');
  });

  it('disables reads and hides old data for invalid URL parameters', async () => {
    const pending = await expectTaskListRequest();
    taskListDataService.setPagination(undefined);
    await TestBed.inject(ApplicationRef).whenStable();
    expect(pending.cancelled).toBe(true);
    expect(taskListDataService.taskListLoadState()).toEqual({ status: 'idle' });
    taskListDataService.reloadTaskList();
    taskListDataService.refreshCurrentPage();
    await TestBed.inject(ApplicationRef).whenStable();
    httpTestingController.expectNone((request) => request.url === '/api/tasks');
  });

  it('refreshes the current page even when an older read is pending', async () => {
    taskListDataService.setPagination({ page: 4, pageSize: 10 });
    const pending = await expectTaskListRequest(4, 10);
    taskListDataService.refreshCurrentPage();
    const refresh = await expectTaskListRequest(4, 10);
    expect(pending.cancelled).toBe(true);
    refresh.flush({ items: [], totalCount: 31, page: 4, pageSize: 10 });
    await TestBed.inject(ApplicationRef).whenStable();
    expect(taskListDataService.taskListLoadState().status).toBe('ready');
  });
});

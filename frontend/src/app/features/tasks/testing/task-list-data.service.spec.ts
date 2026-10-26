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

  async function expectTaskListRequest(): Promise<TestRequest> {
    let taskListRequest: TestRequest | undefined;
    await vi.waitFor(() => {
      taskListRequest = httpTestingController.expectOne('/api/tasks?page=1&pageSize=20');
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
});

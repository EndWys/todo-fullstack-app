import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { appConfig } from '../../../app.config';
import { AuthSessionService } from '../../auth/auth-session.service';
import { AuthUser } from '../../auth/auth.models';
import { TaskListDataService } from '../task-list-page/task-list-data.service';
import { TaskListLoadState } from '../task-list.models';
import { TaskListPageComponent } from '../task-list-page/task-list-page.component';
import {
  sampleTaskSummary,
  createTaskListHttpResponseTestData,
  createTaskListPageTestData,
} from './task-list.test-data';

describe('Task list page presentation boundary', () => {
  const authenticatedUserSignal = signal<AuthUser | undefined>(undefined);
  const taskListLoadStateSignal = signal<TaskListLoadState>({ status: 'loading' });
  const authSessionStub = {
    authenticatedUser: authenticatedUserSignal.asReadonly(),
  } satisfies Pick<AuthSessionService, 'authenticatedUser'>;
  const taskListDataServiceStub = {
    taskListLoadState: taskListLoadStateSignal.asReadonly(),
    reloadTaskList: vi.fn(),
  } satisfies Pick<TaskListDataService, 'taskListLoadState' | 'reloadTaskList'>;
  let componentFixture: ComponentFixture<TaskListPageComponent>;
  let hostElement: HTMLElement;

  beforeEach(async () => {
    authenticatedUserSignal.set({ id: 'user-id', email: 'user@example.com' });
    taskListLoadStateSignal.set({ status: 'loading' });
    taskListDataServiceStub.reloadTaskList.mockClear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthSessionService, useValue: authSessionStub }],
    });
    TestBed.overrideComponent(TaskListPageComponent, {
      set: {
        providers: [{ provide: TaskListDataService, useValue: taskListDataServiceStub }],
      },
    });
    componentFixture = TestBed.createComponent(TaskListPageComponent);
    hostElement = componentFixture.nativeElement;
    await componentFixture.whenStable();
  });

  it('reacts to load state changes through the page signal', async () => {
    expect(hostElement.textContent).toContain('Loading your tasks');

    taskListLoadStateSignal.set({ status: 'ready', pageData: createTaskListPageTestData() });
    await componentFixture.whenStable();
    expect(hostElement.textContent).toContain(sampleTaskSummary.title);

    taskListLoadStateSignal.set({ status: 'error' });
    await componentFixture.whenStable();
    expect(hostElement.querySelector('app-task-list-item')).toBeNull();
    expect(hostElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Tasks could not be loaded',
    );
  });

  it('reacts to identity changes without a separate copy of the user', async () => {
    authenticatedUserSignal.set({ id: 'other-user', email: 'other@example.com' });
    await componentFixture.whenStable();
    expect(hostElement.textContent).toContain('other@example.com');
    expect(hostElement.textContent).not.toContain('user@example.com');

    authenticatedUserSignal.set(undefined);
    await componentFixture.whenStable();
    expect(hostElement.querySelector('#tasks-results')).toBeNull();
    expect(hostElement.textContent).toContain('Your session is no longer confirmed');
  });

  it('delegates retry to the service and focuses the heading', async () => {
    taskListLoadStateSignal.set({ status: 'error' });
    await componentFixture.whenStable();
    const retryTaskListButton = hostElement.querySelector<HTMLButtonElement>('button')!;
    retryTaskListButton.focus();
    retryTaskListButton.click();
    await componentFixture.whenStable();

    expect(taskListDataServiceStub.reloadTaskList).toHaveBeenCalledExactlyOnceWith();
    expect(document.activeElement).toBe(hostElement.querySelector('#tasks-title'));
  });
});

describe('Tasks list page', () => {
  let httpTestingController: HttpTestingController;
  let authSession: AuthSessionService;
  let componentFixture: ComponentFixture<TaskListPageComponent>;
  let hostElement: HTMLElement;
  const authenticatedUser = { id: 'id', email: 'user@example.com' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...appConfig.providers, provideHttpClientTesting()],
    });
    httpTestingController = TestBed.inject(HttpTestingController);
    authSession = TestBed.inject(AuthSessionService);
  });
  afterEach(() => httpTestingController.verify());

  async function mountTaskListPage(): Promise<TestRequest> {
    const sessionRestoration = authSession.restoreSession();
    httpTestingController.expectOne('/api/auth/me').flush(authenticatedUser);
    await sessionRestoration;
    componentFixture = TestBed.createComponent(TaskListPageComponent);
    hostElement = componentFixture.nativeElement;
    return expectTaskListRequest();
  }
  async function expectTaskListRequest(): Promise<TestRequest> {
    let taskListRequest: TestRequest;
    await vi.waitFor(() => {
      taskListRequest = httpTestingController.expectOne('/api/tasks?page=1&pageSize=20');
    });
    return taskListRequest!;
  }

  it('loads once with server pagination, no owner selection and no CSRF bootstrap', async () => {
    const pendingTaskListRequest = await mountTaskListPage();
    expect(pendingTaskListRequest.request.method).toBe('GET');
    expect(pendingTaskListRequest.request.params.keys()).toEqual(['page', 'pageSize']);
    expect(pendingTaskListRequest.request.body).toBeNull();
    expect(pendingTaskListRequest.request.timeout).toBe(15_000);
    expect(pendingTaskListRequest.request.cache).toBe('no-store');
    expect(hostElement.textContent).toContain('Loading your tasks');
    expect(hostElement.querySelector('#tasks-results')?.getAttribute('aria-busy')).toBe('true');
    expect(hostElement.querySelector<HTMLButtonElement>('button')?.disabled).toBe(true);
    pendingTaskListRequest.flush(createTaskListHttpResponseTestData());
    await componentFixture.whenStable();
    expect(hostElement.querySelectorAll('ul[aria-label="Tasks"] > li')).toHaveLength(1);
    expect(hostElement.querySelector('app-task-list-item h2')?.textContent).toBe(
      sampleTaskSummary.title,
    );
    expect(hostElement.textContent).toContain('Showing 1 of 1 tasks.');
    expect(hostElement.querySelector('#tasks-results')?.getAttribute('aria-busy')).toBe('false');
    httpTestingController.expectNone('/api/auth/csrf');
  });

  it('shows the server order, an explicit page limit and no description', async () => {
    const pendingTaskListRequest = await mountTaskListPage();
    const secondTaskSummary = {
      ...sampleTaskSummary,
      id: '22222222-2222-2222-2222-222222222222',
      title: 'Second',
      priority: 'high' as const,
    };
    pendingTaskListRequest.flush(
      createTaskListHttpResponseTestData([sampleTaskSummary, secondTaskSummary], 41),
    );
    await componentFixture.whenStable();
    expect(
      Array.from(hostElement.querySelectorAll('app-task-list-item h2')).map(
        (taskTitleElement) => taskTitleElement.textContent,
      ),
    ).toEqual([sampleTaskSummary.title, 'Second']);
    expect(hostElement.textContent).toContain('Showing 2 of 41 tasks.');
    expect(hostElement.textContent).toContain('Only the first page (up to 20 tasks) is shown');
  });

  it('shows a successful empty state, not an error', async () => {
    (await mountTaskListPage()).flush(createTaskListHttpResponseTestData([]));
    await componentFixture.whenStable();
    expect(hostElement.textContent).toContain('No tasks to display.');
    expect(hostElement.textContent).toContain('Showing 0 of 0 tasks.');
    expect(hostElement.querySelector('[role="alert"]')).toBeNull();
    expect(hostElement.querySelector('ul')).toBeNull();
  });

  it.each([0, 400, 403, 500])(
    'shows a safe error for %s and retries only on an explicit click',
    async (status) => {
      const pendingTaskListRequest = await mountTaskListPage();
      if (status === 0) pendingTaskListRequest.error(new ProgressEvent('error'));
      else
        pendingTaskListRequest.flush(
          { detail: 'PRIVATE-SQL-DETAILS' },
          { status, statusText: 'Failure' },
        );
      await componentFixture.whenStable();
      expect(hostElement.querySelector('[role="alert"]')?.textContent).toContain(
        'Tasks could not be loaded',
      );
      expect(hostElement.textContent).not.toContain('PRIVATE-SQL-DETAILS');
      expect(authSession.authenticatedUser()).toEqual(authenticatedUser);
      httpTestingController.expectNone((request) => request.url === '/api/tasks');
      hostElement.querySelector<HTMLButtonElement>('button')!.click();
      (await expectTaskListRequest()).flush(createTaskListHttpResponseTestData());
      await componentFixture.whenStable();
      expect(hostElement.querySelector('[role="alert"]')).toBeNull();
      expect(hostElement.textContent).toContain(sampleTaskSummary.title);
      expect(document.activeElement?.id).toBe('tasks-title');
    },
  );

  it.each([
    null,
    {},
    { ...createTaskListHttpResponseTestData(), page: 2 },
    { ...createTaskListHttpResponseTestData(), pageSize: 10 },
  ])('does not turn a malformed response %# into an empty success', async (responseBody) => {
    (await mountTaskListPage()).flush(responseBody);
    await componentFixture.whenStable();
    expect(hostElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(hostElement.textContent).not.toContain('No tasks to display.');
  });

  it('rejects an unexpected success status', async () => {
    (await mountTaskListPage()).flush(createTaskListHttpResponseTestData(), {
      status: 201,
      statusText: 'Created',
    });
    await componentFixture.whenStable();
    expect(hostElement.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('refreshes explicitly, hides old data while loading and disables duplicate refresh', async () => {
    (await mountTaskListPage()).flush(createTaskListHttpResponseTestData());
    await componentFixture.whenStable();
    const refreshTasksButton = hostElement.querySelector<HTMLButtonElement>('button')!;
    refreshTasksButton.click();
    const pendingTaskListRequest = await expectTaskListRequest();
    expect(hostElement.querySelector('app-task-list-item')).toBeNull();
    expect(refreshTasksButton.disabled).toBe(true);
    refreshTasksButton.click();
    httpTestingController.expectNone((request) => request.url === '/api/tasks');
    pendingTaskListRequest.flush(createTaskListHttpResponseTestData([]));
    await componentFixture.whenStable();
    expect(hostElement.textContent).toContain('No tasks to display.');
  });

  it('does not send a request before identity is confirmed', async () => {
    componentFixture = TestBed.createComponent(TaskListPageComponent);
    await componentFixture.whenStable();
    httpTestingController.expectNone((request) => request.url === '/api/tasks');
    expect(componentFixture.nativeElement.textContent).toContain(
      'Your session is no longer confirmed',
    );
  });

  it('clears visible data and does not refresh after the current protected request returns 401', async () => {
    (await mountTaskListPage()).flush(createTaskListHttpResponseTestData());
    await componentFixture.whenStable();
    hostElement.querySelector<HTMLButtonElement>('button')!.click();
    (await expectTaskListRequest()).flush({}, { status: 401, statusText: 'Unauthorized' });
    await componentFixture.whenStable();
    expect(authSession.sessionState().status).toBe('anonymous');
    expect(hostElement.querySelector('app-task-list-item')).toBeNull();
    expect(hostElement.textContent).not.toContain(sampleTaskSummary.title);
    httpTestingController.expectNone((request) => request.url === '/api/tasks');
  });

  it('cancels an in-flight read when the page is destroyed', async () => {
    const pendingTaskListRequest = await mountTaskListPage();
    componentFixture.destroy();
    expect(pendingTaskListRequest.cancelled).toBe(true);
  });

  it('cancels the previous identity read and fetches fresh data after a different login', async () => {
    const previousUserRequest = await mountTaskListPage();
    const loginOperation = authSession.loginUser({
      email: 'other@example.com',
      password: 'password',
    });
    httpTestingController
      .expectOne('/api/auth/csrf')
      .flush(null, { status: 204, statusText: 'No Content' });
    httpTestingController
      .expectOne('/api/auth/login')
      .flush({ id: 'other', email: 'other@example.com' });
    await loginOperation;
    const nextUserRequest = await expectTaskListRequest();
    expect(previousUserRequest.cancelled).toBe(true);
    nextUserRequest.flush(createTaskListHttpResponseTestData([]));
    await componentFixture.whenStable();
    expect(hostElement.textContent).toContain('other@example.com');
    expect(hostElement.textContent).not.toContain(sampleTaskSummary.title);
    expect(hostElement.textContent).toContain('No tasks to display.');
  });

  it('hides a previously loaded account result until the new account result arrives', async () => {
    (await mountTaskListPage()).flush(createTaskListHttpResponseTestData());
    await componentFixture.whenStable();
    expect(hostElement.textContent).toContain(sampleTaskSummary.title);
    const loginOperation = authSession.loginUser({
      email: 'other@example.com',
      password: 'password',
    });
    httpTestingController
      .expectOne('/api/auth/csrf')
      .flush(null, { status: 204, statusText: 'No Content' });
    httpTestingController
      .expectOne('/api/auth/login')
      .flush({ id: 'other', email: 'other@example.com' });
    await loginOperation;
    const pendingTaskListRequest = await expectTaskListRequest();
    expect(hostElement.textContent).not.toContain(sampleTaskSummary.title);
    pendingTaskListRequest.flush(createTaskListHttpResponseTestData([]));
    await componentFixture.whenStable();
    expect(hostElement.textContent).toContain('No tasks to display.');
  });

  it('does not reuse loaded data when another instance of the page is created', async () => {
    (await mountTaskListPage()).flush(createTaskListHttpResponseTestData());
    await componentFixture.whenStable();
    componentFixture.destroy();
    componentFixture = TestBed.createComponent(TaskListPageComponent);
    hostElement = componentFixture.nativeElement;
    const pendingTaskListRequest = await expectTaskListRequest();
    expect(hostElement.querySelector('app-task-list-item')).toBeNull();
    pendingTaskListRequest.flush(createTaskListHttpResponseTestData([]));
    await componentFixture.whenStable();
    expect(hostElement.textContent).toContain('No tasks to display.');
  });
});

describe('Task list page size explanation', () => {
  it('displays the size from page data rather than a hard-coded default', async () => {
    const taskListDataServiceStub = {
      taskListLoadState: signal<TaskListLoadState>({
        status: 'ready',
        pageData: { tasks: [], totalCount: 51, page: 1, pageSize: 50 },
      }).asReadonly(),
      reloadTaskList: vi.fn(),
    } satisfies Pick<TaskListDataService, 'taskListLoadState' | 'reloadTaskList'>;

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthSessionService,
          useValue: { authenticatedUser: signal({ id: 'user-id', email: 'user@example.com' }) },
        },
      ],
    });
    TestBed.overrideComponent(TaskListPageComponent, {
      set: {
        providers: [
          {
            provide: TaskListDataService,
            useValue: taskListDataServiceStub,
          },
        ],
      },
    });
    const componentFixture = TestBed.createComponent(TaskListPageComponent);
    await componentFixture.whenStable();
    const hostElement: HTMLElement = componentFixture.nativeElement;

    expect(hostElement.textContent).toContain('Only the first page (up to 50 tasks) is shown');
    expect(hostElement.textContent).not.toContain('up to 20 tasks');
  });
});

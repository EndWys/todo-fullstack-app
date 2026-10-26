import { HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { firstValueFrom } from 'rxjs';
import { appConfig } from '../../../app.config';
import { TaskListPageComponent } from '../../tasks/task-list-page/task-list-page.component';
import { AuthSessionService } from '../auth-session.service';
import { createTaskListHttpResponseTestData } from '../../tasks/testing/task-list.test-data';

describe('Session expiry interceptor routing and Tasks integration', () => {
  let httpTestingController: HttpTestingController;
  let httpClient: HttpClient;
  let authSessionService: AuthSessionService;
  let routerHarness: RouterTestingHarness;
  const authenticatedUser = { id: 'id', email: 'user@example.com' };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [...appConfig.providers, provideHttpClientTesting()],
    });
    httpTestingController = TestBed.inject(HttpTestingController);
    httpClient = TestBed.inject(HttpClient);
    authSessionService = TestBed.inject(AuthSessionService);
    routerHarness = await RouterTestingHarness.create();
    const navigationPromise = routerHarness.navigateByUrl('/tasks', TaskListPageComponent);
    await vi.waitFor(() =>
      httpTestingController.expectOne('/api/auth/me').flush(authenticatedUser),
    );
    await vi.waitFor(() =>
      httpTestingController
        .expectOne('/api/tasks?page=1&pageSize=20')
        .flush(createTaskListHttpResponseTestData([])),
    );
    await navigationPromise;
    await routerHarness.fixture.whenStable();
  });
  afterEach(() => httpTestingController.verify());

  it('redirects when the actual resource-backed list refresh returns 401', async () => {
    routerHarness.routeNativeElement?.querySelector<HTMLButtonElement>('button')!.click();
    await vi.waitFor(() =>
      httpTestingController
        .expectOne('/api/tasks?page=1&pageSize=20')
        .flush({}, { status: 401, statusText: 'Unauthorized' }),
    );
    await routerHarness.fixture.whenStable();
    expect(authSessionService.sessionState().status).toBe('anonymous');
    expect(TestBed.inject(Router).url).toBe('/login?reason=session-ended');
    expect(routerHarness.routeNativeElement?.querySelector('app-task-list-item')).toBeNull();
    httpTestingController.expectNone((httpRequest) => httpRequest.url === '/api/tasks');
    httpTestingController.expectNone('/api/auth/csrf');
  });

  it.each(['/api/tasks', '/api/tasks?page=2&pageSize=10', '/api/tasks/some-id'])(
    'clears the current identity on %s 401 and redirects the active Tasks page',
    async (url) => {
      const pendingOperationPromise = firstValueFrom(httpClient.get(url));
      const requestFailureAssertion = expect(pendingOperationPromise).rejects.toMatchObject({
        status: 401,
      });
      httpTestingController.expectOne(url).flush({}, { status: 401, statusText: 'Unauthorized' });
      await requestFailureAssertion;
      await routerHarness.fixture.whenStable();
      expect(authSessionService.authenticatedUser()).toBeUndefined();
      expect(authSessionService.sessionState().status).toBe('anonymous');
      expect(TestBed.inject(Router).url).toBe('/login?reason=session-ended');
      expect(routerHarness.routeNativeElement?.textContent).toContain(
        'Your session is no longer available',
      );
      expect(document.activeElement?.id).toBe('login-title');
      httpTestingController.expectNone('/api/auth/csrf');
      httpTestingController.expectNone('/api/auth/logout');
    },
  );

  it.each([
    '/api/auth/login',
    '/api/auth/me',
    '/api/tasks-archive',
    'https://other.example/api/tasks',
  ])('does not treat a 401 from %s as a protected Tasks failure', async (url) => {
    const pendingOperationPromise = firstValueFrom(httpClient.get(url));
    const requestFailureAssertion = expect(pendingOperationPromise).rejects.toMatchObject({
      status: 401,
    });
    httpTestingController.expectOne(url).flush({}, { status: 401, statusText: 'Unauthorized' });
    await requestFailureAssertion;
    expect(authSessionService.authenticatedUser()).toEqual(authenticatedUser);
    expect(TestBed.inject(Router).url).toBe('/tasks');
  });

  it.each([0, 400, 403, 500])(
    'preserves identity and the original non-401 error %s',
    async (status) => {
      const pendingOperationPromise = firstValueFrom(httpClient.get('/api/tasks'));
      const requestFailureAssertion = expect(pendingOperationPromise).rejects.toMatchObject({
        status,
      });
      const httpRequest = httpTestingController.expectOne('/api/tasks');
      if (status === 0) httpRequest.error(new ProgressEvent('error'));
      else httpRequest.flush({}, { status, statusText: 'Failure' });
      await requestFailureAssertion;
      expect(authSessionService.authenticatedUser()).toEqual(authenticatedUser);
      expect(TestBed.inject(Router).url).toBe('/tasks');
    },
  );

  it('does not retry a failed POST or convert its error into success', async () => {
    const pendingOperationPromise = firstValueFrom(
      httpClient.post('/api/tasks', { title: 'Title' }),
    );
    const requestFailureAssertion = expect(pendingOperationPromise).rejects.toMatchObject({
      status: 401,
    });
    httpTestingController
      .expectOne('/api/tasks')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await requestFailureAssertion;
    await routerHarness.fixture.whenStable();
    httpTestingController.expectNone('/api/tasks');
    httpTestingController.expectNone('/api/auth/csrf');
  });

  it('does not redirect an unrelated page when a background Tasks request returns 401', async () => {
    await routerHarness.navigateByUrl('/register');
    const pendingOperationPromise = firstValueFrom(httpClient.get('/api/tasks'));
    const requestFailureAssertion = expect(pendingOperationPromise).rejects.toMatchObject({
      status: 401,
    });
    httpTestingController
      .expectOne('/api/tasks')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await requestFailureAssertion;
    expect(authSessionService.authenticatedUser()).toBeUndefined();
    expect(TestBed.inject(Router).url).toBe('/register');
  });

  it('ignores a late 401 from before a new login, including a login as the same user', async () => {
    const previousRequestPromise = firstValueFrom(httpClient.get('/api/tasks'));
    const requestFailureAssertion = expect(previousRequestPromise).rejects.toMatchObject({
      status: 401,
    });
    const loginOperationPromise = authSessionService.loginUser({
      email: authenticatedUser.email,
      password: 'password',
    });
    httpTestingController
      .expectOne('/api/auth/csrf')
      .flush(null, { status: 204, statusText: 'No Content' });
    httpTestingController.expectOne('/api/auth/login').flush(authenticatedUser);
    await loginOperationPromise;
    await vi.waitFor(() =>
      httpTestingController
        .expectOne('/api/tasks?page=1&pageSize=20')
        .flush(createTaskListHttpResponseTestData([])),
    );
    httpTestingController
      .expectOne('/api/tasks')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await requestFailureAssertion;
    expect(authSessionService.authenticatedUser()).toEqual(authenticatedUser);
    expect(TestBed.inject(Router).url).toBe('/tasks');
  });

  it('does not overwrite a pending login even if the request captured its current revision', async () => {
    const loginOperationPromise = authSessionService.loginUser({
      email: authenticatedUser.email,
      password: 'password',
    });
    const pendingOperationPromise = firstValueFrom(httpClient.get('/api/tasks'));
    const requestFailureAssertion = expect(pendingOperationPromise).rejects.toMatchObject({
      status: 401,
    });
    httpTestingController
      .expectOne('/api/tasks')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await requestFailureAssertion;
    expect(authSessionService.isAuthOperationInProgress()).toBe(true);
    httpTestingController
      .expectOne('/api/auth/csrf')
      .flush(null, { status: 204, statusText: 'No Content' });
    httpTestingController.expectOne('/api/auth/login').flush(authenticatedUser);
    await loginOperationPromise;
    await vi.waitFor(() =>
      httpTestingController
        .expectOne('/api/tasks?page=1&pageSize=20')
        .flush(createTaskListHttpResponseTestData([])),
    );
    expect(authSessionService.authenticatedUser()).toEqual(authenticatedUser);
    expect(TestBed.inject(Router).url).toBe('/tasks');
  });

  it('ignores a 401 received after login from a request dispatched during that login', async () => {
    const loginOperationPromise = authSessionService.loginUser({
      email: authenticatedUser.email,
      password: 'password',
    });
    const pendingOperationPromise = firstValueFrom(httpClient.get('/api/tasks'));
    const requestFailureAssertion = expect(pendingOperationPromise).rejects.toMatchObject({
      status: 401,
    });
    httpTestingController
      .expectOne('/api/auth/csrf')
      .flush(null, { status: 204, statusText: 'No Content' });
    httpTestingController.expectOne('/api/auth/login').flush(authenticatedUser);
    await loginOperationPromise;
    await vi.waitFor(() =>
      httpTestingController
        .expectOne('/api/tasks?page=1&pageSize=20')
        .flush(createTaskListHttpResponseTestData([])),
    );
    httpTestingController
      .expectOne('/api/tasks')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await requestFailureAssertion;
    expect(authSessionService.authenticatedUser()).toEqual(authenticatedUser);
    expect(TestBed.inject(Router).url).toBe('/tasks');
  });
});

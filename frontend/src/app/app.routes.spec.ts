import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { RegistrationPageComponent } from './features/auth/registration-page/registration-page.component';
import { LoginPageComponent } from './features/auth/login-page/login-page.component';
import { TaskListPageComponent } from './features/tasks/task-list-page/task-list-page.component';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthSessionService } from './features/auth/auth-session.service';
import { createTaskListHttpResponseTestData } from './features/tasks/testing/task-list.test-data';

describe('Application routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('redirects a guest from the root URL through the Tasks guard to sign-in', async () => {
    const harness = await RouterTestingHarness.create();
    const navigation = harness.navigateByUrl('/', LoginPageComponent);
    await vi.waitFor(() =>
      TestBed.inject(HttpTestingController)
        .expectOne('/api/auth/me')
        .flush({}, { status: 401, statusText: 'Unauthorized' }),
    );
    await navigation;

    expect(TestBed.inject(Router).url).toBe('/login');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent?.trim()).toBe('Sign in');
  });

  it.each(['/', '/tasks'])(
    'opens %s as Tasks only after the server confirms identity',
    async (url) => {
      const harness = await RouterTestingHarness.create();
      const navigation = harness.navigateByUrl(url, TaskListPageComponent);
      await vi.waitFor(() =>
        TestBed.inject(HttpTestingController)
          .expectOne('/api/auth/me')
          .flush({ id: 'id', email: 'user@example.com' }),
      );
      await vi.waitFor(() =>
        TestBed.inject(HttpTestingController)
          .expectOne('/api/tasks?page=1&pageSize=20')
          .flush(createTaskListHttpResponseTestData([])),
      );
      await navigation;
      expect(TestBed.inject(Router).url).toBe('/tasks');
      expect(TestBed.inject(Title).getTitle()).toBe('My tasks — TodoApp');
      expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('My tasks');
      expect(document.activeElement?.id).toBe('tasks-title');
      TestBed.inject(HttpTestingController).expectNone('/api/auth/csrf');
    },
  );

  it('waits for and shares the startup restoration rather than treating unknown as a guest', async () => {
    const session = TestBed.inject(AuthSessionService);
    const restoring = session.restoreSession();
    const restoreSpy = vi.spyOn(session, 'restoreSession');
    const harness = await RouterTestingHarness.create();
    const navigation = harness.navigateByUrl('/tasks', TaskListPageComponent);
    await vi.waitFor(() => expect(restoreSpy).toHaveBeenCalledWith(true));
    expect(harness.routeNativeElement?.querySelector('#tasks-title')).toBeFalsy();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/auth/me')
      .flush({ id: 'id', email: 'user@example.com' });
    await restoring;
    await vi.waitFor(() =>
      TestBed.inject(HttpTestingController)
        .expectOne('/api/tasks?page=1&pageSize=20')
        .flush(createTaskListHttpResponseTestData([])),
    );
    await navigation;
    expect(TestBed.inject(Router).url).toBe('/tasks');
  });

  it('rechecks a cached user and redirects to login after a fresh /me 401', async () => {
    const session = TestBed.inject(AuthSessionService);
    const restoring = session.restoreSession();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/auth/me')
      .flush({ id: 'id', email: 'user@example.com' });
    await restoring;
    const harness = await RouterTestingHarness.create();
    const navigation = harness.navigateByUrl('/tasks', LoginPageComponent);
    await vi.waitFor(() =>
      TestBed.inject(HttpTestingController)
        .expectOne('/api/auth/me')
        .flush({}, { status: 401, statusText: 'Unauthorized' }),
    );
    await navigation;
    expect(TestBed.inject(Router).url).toBe('/login');
    expect(session.sessionState().status).toBe('anonymous');
    expect(session.authenticatedUser()).toBeUndefined();
    expect(document.activeElement?.id).toBe('login-title');
  });

  it.each([0, 500])(
    'does not activate Tasks or claim a guest when /me fails with %s',
    async (status) => {
      const harness = await RouterTestingHarness.create();
      const navigation = harness.navigateByUrl('/tasks', LoginPageComponent);
      await vi.waitFor(() => {
        const request = TestBed.inject(HttpTestingController).expectOne('/api/auth/me');
        if (status === 0) request.error(new ProgressEvent('error'));
        else request.flush({}, { status, statusText: 'Server Error' });
      });
      await navigation;
      expect(TestBed.inject(Router).url).toBe('/login');
      expect(TestBed.inject(AuthSessionService).sessionState().status).toBe('error');
      expect(harness.routeNativeElement?.textContent).toContain(
        'Your session could not be confirmed',
      );
      expect(harness.routeNativeElement?.textContent).toContain('Check session');
    },
  );

  it('does not enter Tasks using an old identity while logout is pending', async () => {
    const session = TestBed.inject(AuthSessionService);
    const restoring = session.restoreSession();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/auth/me').flush({ id: 'id', email: 'user@example.com' });
    await restoring;
    const logout = session.logoutUser();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/tasks', LoginPageComponent);
    expect(TestBed.inject(Router).url).toBe('/login');
    http.expectNone('/api/auth/me');
    http.expectOne('/api/auth/csrf').flush(null, { status: 204, statusText: 'No Content' });
    http.expectOne('/api/auth/logout').flush(null, { status: 204, statusText: 'No Content' });
    await logout;
    expect(session.sessionState().status).toBe('anonymous');
  });

  it('opens registration directly and sets the document title', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/register', RegistrationPageComponent);

    expect(page).toBeInstanceOf(RegistrationPageComponent);
    expect(TestBed.inject(Router).url).toBe('/register');
    expect(TestBed.inject(Title).getTitle()).toBe('Register — TodoApp');
  });

  it('opens login directly with its own document title', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/login', LoginPageComponent);
    expect(TestBed.inject(Title).getTitle()).toBe('Sign in — TodoApp');
  });
});

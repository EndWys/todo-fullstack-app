import { flushAuthCsrfBootstrap } from './auth-csrf.test-helper';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthSessionService } from '../auth-session.service';

describe('AuthSessionService HTTP integration', () => {
  let authSessionService: AuthSessionService;
  let httpTestingController: HttpTestingController;
  const authenticatedUser = { id: 'id', email: 'user@example.com' };
  const loginRequest = { email: authenticatedUser.email, password: 'password' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    authSessionService = TestBed.inject(AuthSessionService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });
  afterEach(() => httpTestingController.verify());
  async function signInTestUser() {
    const pendingOperationPromise = authSessionService.loginUser(loginRequest);
    flushAuthCsrfBootstrap(httpTestingController);
    httpTestingController.expectOne('/api/auth/login').flush(authenticatedUser);
    await pendingOperationPromise;
  }

  it('starts unknown and restores a session from /me, coalescing duplicate restores', async () => {
    expect(authSessionService.sessionState().status).toBe('unknown');
    const firstRestorationPromise = authSessionService.restoreSession();
    const secondRestorationPromise = authSessionService.restoreSession();
    expect(firstRestorationPromise).toBe(secondRestorationPromise);
    expect(authSessionService.isAuthOperationInProgress()).toBe(true);
    httpTestingController.expectOne('/api/auth/me').flush(authenticatedUser);
    await firstRestorationPromise;
    expect(authSessionService.authenticatedUser()).toEqual(authenticatedUser);
    expect(authSessionService.isAuthOperationInProgress()).toBe(false);
    await authSessionService.restoreSession();
    httpTestingController.expectNone('/api/auth/me');
  });

  it('confirms anonymous state only when /me returns 401', async () => {
    const pendingOperationPromise = authSessionService.restoreSession();
    httpTestingController
      .expectOne('/api/auth/me')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await pendingOperationPromise;
    expect(authSessionService.sessionState().status).toBe('anonymous');
    expect(authSessionService.authenticatedUser()).toBeUndefined();
  });

  it('offers explicit recovery after a failed restore instead of claiming guest status', async () => {
    const pendingOperationPromise = authSessionService.restoreSession();
    httpTestingController.expectOne('/api/auth/me').error(new ProgressEvent('error'));
    await pendingOperationPromise;
    expect(authSessionService.sessionState().status).toBe('error');
    const retryRestorationPromise = authSessionService.restoreSession(true);
    httpTestingController.expectOne('/api/auth/me').flush(authenticatedUser);
    await retryRestorationPromise;
    expect(authSessionService.authenticatedUser()).toEqual(authenticatedUser);
  });

  it('sets identity only after login succeeds and clears it only after logout succeeds', async () => {
    await signInTestUser();
    expect(authSessionService.sessionState().status).toBe('authenticated');
    const pendingOperationPromise = authSessionService.logoutUser();
    expect(authSessionService.authenticatedUser()).toEqual(authenticatedUser);
    flushAuthCsrfBootstrap(httpTestingController);
    httpTestingController
      .expectOne('/api/auth/logout')
      .flush(null, { status: 204, statusText: 'No Content' });
    await pendingOperationPromise;
    expect(authSessionService.sessionState().status).toBe('anonymous');
    expect(authSessionService.authenticatedUser()).toBeUndefined();
  });

  it('does not report successful login when credentials fail', async () => {
    const sessionRestorationPromise = authSessionService.restoreSession();
    httpTestingController
      .expectOne('/api/auth/me')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await sessionRestorationPromise;
    const pendingOperationPromise = authSessionService.loginUser(loginRequest);
    const requestFailureAssertion = expect(pendingOperationPromise).rejects.toMatchObject({
      status: 401,
    });
    flushAuthCsrfBootstrap(httpTestingController);
    httpTestingController
      .expectOne('/api/auth/login')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await requestFailureAssertion;
    expect(authSessionService.sessionState().status).toBe('anonymous');
    expect(authSessionService.isAuthOperationInProgress()).toBe(false);
  });

  it('marks ambiguous login failure as unknown outcome and can recover via /me', async () => {
    const pendingOperationPromise = authSessionService.loginUser(loginRequest);
    const requestFailureAssertion = expect(pendingOperationPromise).rejects.toMatchObject({
      status: 0,
    });
    flushAuthCsrfBootstrap(httpTestingController);
    httpTestingController.expectOne('/api/auth/login').error(new ProgressEvent('error'));
    await requestFailureAssertion;
    expect(authSessionService.sessionState().status).toBe('error');
    const sessionCheckPromise = authSessionService.restoreSession(true);
    httpTestingController.expectOne('/api/auth/me').flush(authenticatedUser);
    await sessionCheckPromise;
    expect(authSessionService.authenticatedUser()).toEqual(authenticatedUser);
  });

  it('does not claim logout on a lost response and recovers the server outcome', async () => {
    await signInTestUser();
    const pendingOperationPromise = authSessionService.logoutUser();
    const requestFailureAssertion = expect(pendingOperationPromise).rejects.toMatchObject({
      status: 0,
    });
    flushAuthCsrfBootstrap(httpTestingController);
    httpTestingController.expectOne('/api/auth/logout').error(new ProgressEvent('error'));
    await requestFailureAssertion;
    expect(authSessionService.sessionState().status).toBe('error');
    const sessionCheckPromise = authSessionService.restoreSession(true);
    httpTestingController
      .expectOne('/api/auth/me')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await sessionCheckPromise;
    expect(authSessionService.sessionState().status).toBe('anonymous');
  });

  it('serializes restoration and mutations so stale /me cannot overwrite login', async () => {
    const sessionRestorationPromise = authSessionService.restoreSession();
    await expect(authSessionService.loginUser(loginRequest)).rejects.toThrow('already pending');
    httpTestingController.expectNone('/api/auth/csrf');
    httpTestingController
      .expectOne('/api/auth/me')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await sessionRestorationPromise;
    await signInTestUser();
    expect(authSessionService.authenticatedUser()).toEqual(authenticatedUser);
  });

  it('does not start a duplicate mutation or /me while login is pending', async () => {
    const pendingOperationPromise = authSessionService.loginUser(loginRequest);
    await authSessionService.restoreSession(true);
    await expect(authSessionService.logoutUser()).rejects.toThrow('already pending');
    httpTestingController.expectNone('/api/auth/me');
    flushAuthCsrfBootstrap(httpTestingController);
    httpTestingController.expectOne('/api/auth/login').flush(authenticatedUser);
    await pendingOperationPromise;
  });

  it('preserves an already-confirmed identity on a definitively rejected login', async () => {
    await signInTestUser();
    const pendingOperationPromise = authSessionService.loginUser(loginRequest);
    const requestFailureAssertion = expect(pendingOperationPromise).rejects.toMatchObject({
      status: 401,
    });
    flushAuthCsrfBootstrap(httpTestingController);
    httpTestingController
      .expectOne('/api/auth/login')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await requestFailureAssertion;
    expect(authSessionService.authenticatedUser()).toEqual(authenticatedUser);
  });
});

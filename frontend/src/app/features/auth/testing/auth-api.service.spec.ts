import { provideHttpClient, withXsrfConfiguration } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AuthApiService } from '../auth-api.service';

describe('AuthApiService registration HTTP integration', () => {
  let authApiService: AuthApiService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXsrfConfiguration({ cookieName: '__Host-TodoApp.Xsrf' })),
        provideHttpClientTesting(),
      ],
    });
    authApiService = TestBed.inject(AuthApiService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTestingController.verify());

  it('posts the exact DTO to the relative registration URL', async () => {
    const registrationRequest = { email: 'Denis@example.com', password: '  correct horse  ' };
    const registrationResponse = { id: 'user-id', email: registrationRequest.email };
    const requestResultPromise = firstValueFrom(authApiService.registerUser(registrationRequest));
    httpTestingController.expectNone('/api/auth/register');
    httpTestingController
      .expectOne('/api/auth/csrf')
      .flush(null, { status: 204, statusText: 'No Content' });
    const httpRequest = httpTestingController.expectOne('/api/auth/register');
    expect(httpRequest.request.method).toBe('POST');
    expect(httpRequest.request.body).toEqual(registrationRequest);
    expect(httpRequest.request.timeout).toBe(15_000);
    httpRequest.flush(registrationResponse, { status: 201, statusText: 'Created' });
    await expect(requestResultPromise).resolves.toEqual(registrationResponse);
  });

  it.each([
    { status: 200, statusText: 'OK', body: { id: 'user-id', email: 'denis@example.com' } },
    { status: 201, statusText: 'Created', body: { email: 'denis@example.com' } },
  ])(
    'rejects an unexpected success response: $status',
    async ({ status, statusText, body: responseBody }) => {
      const requestResultPromise = firstValueFrom(
        authApiService.registerUser({ email: 'denis@example.com', password: 'password' }),
      );
      const requestFailureAssertion = expect(requestResultPromise).rejects.toThrow(
        'Unexpected registration response',
      );
      httpTestingController
        .expectOne('/api/auth/csrf')
        .flush(null, { status: 204, statusText: 'No Content' });
      httpTestingController
        .expectOne('/api/auth/register')
        .flush(responseBody, { status, statusText });
      await requestFailureAssertion;
    },
  );

  it('preserves HTTP errors for the page and does not automatically retry', async () => {
    const requestResultPromise = firstValueFrom(
      authApiService.registerUser({ email: 'denis@example.com', password: 'password' }),
    );
    const requestFailureAssertion = expect(requestResultPromise).rejects.toMatchObject({
      status: 409,
    });
    httpTestingController
      .expectOne('/api/auth/csrf')
      .flush(null, { status: 204, statusText: 'No Content' });
    httpTestingController
      .expectOne('/api/auth/register')
      .flush(
        { errors: { email: ['Email is already registered.'] } },
        { status: 409, statusText: 'Conflict' },
      );
    await requestFailureAssertion;
    httpTestingController.expectNone('/api/auth/register');
  });

  it('does not submit credentials if token preparation fails', async () => {
    const requestResultPromise = firstValueFrom(
      authApiService.registerUser({ email: 'denis@example.com', password: 'password' }),
    );
    const requestFailureAssertion = expect(requestResultPromise).rejects.toMatchObject({
      status: 500,
    });
    httpTestingController
      .expectOne('/api/auth/csrf')
      .flush({}, { status: 500, statusText: 'Server Error' });
    await requestFailureAssertion;
    httpTestingController.expectNone('/api/auth/register');
  });

  it('does not automatically replay a POST rejected by CSRF validation', async () => {
    const requestResultPromise = firstValueFrom(
      authApiService.registerUser({ email: 'denis@example.com', password: 'password' }),
    );
    const requestFailureAssertion = expect(requestResultPromise).rejects.toMatchObject({
      status: 400,
    });
    httpTestingController
      .expectOne('/api/auth/csrf')
      .flush(null, { status: 204, statusText: 'No Content' });
    httpTestingController
      .expectOne('/api/auth/register')
      .flush(
        { code: 'csrf_validation_failed', title: 'CSRF validation failed.' },
        { status: 400, statusText: 'Bad Request' },
      );
    await requestFailureAssertion;
    httpTestingController.expectNone('/api/auth/csrf');
    httpTestingController.expectNone('/api/auth/register');
  });
});

describe('AuthApiService login and session HTTP integration', () => {
  let authApiService: AuthApiService;
  let httpTestingController: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    authApiService = TestBed.inject(AuthApiService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });
  afterEach(() => httpTestingController.verify());
  function flushCsrfBootstrap() {
    const csrfBootstrapRequest = httpTestingController.expectOne('/api/auth/csrf');
    expect(csrfBootstrapRequest.request.timeout).toBe(15_000);
    csrfBootstrapRequest.flush(null, { status: 204, statusText: 'No Content' });
  }

  it('prepares CSRF then sends login unchanged and reads only public identity fields', async () => {
    const loginRequest = { email: 'User@Example.com', password: '  password with spaces  ' };
    const requestResultPromise = firstValueFrom(authApiService.loginUser(loginRequest));
    httpTestingController.expectNone('/api/auth/login');
    flushCsrfBootstrap();
    const httpRequest = httpTestingController.expectOne('/api/auth/login');
    expect(httpRequest.request.timeout).toBe(15_000);
    expect(httpRequest.request.method).toBe('POST');
    expect(httpRequest.request.body).toEqual(loginRequest);
    expect(httpRequest.request.headers.has('Authorization')).toBe(false);
    httpRequest.flush({ id: 'id', email: loginRequest.email, ignored: 'not stored' });
    await expect(requestResultPromise).resolves.toEqual({ id: 'id', email: loginRequest.email });
  });

  it('preserves login 401 rather than converting it into a guest success', async () => {
    const requestResultPromise = firstValueFrom(
      authApiService.loginUser({ email: 'user@example.com', password: 'wrong password' }),
    );
    const requestFailureAssertion = expect(requestResultPromise).rejects.toMatchObject({
      status: 401,
    });
    flushCsrfBootstrap();
    httpTestingController
      .expectOne('/api/auth/login')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await requestFailureAssertion;
  });

  it('restores identity with a non-cached GET without CSRF bootstrap', async () => {
    const requestResultPromise = firstValueFrom(authApiService.getCurrentUser());
    const httpRequest = httpTestingController.expectOne('/api/auth/me');
    expect(httpRequest.request.timeout).toBe(15_000);
    expect(httpRequest.request.method).toBe('GET');
    expect(httpRequest.request.cache).toBe('no-store');
    httpRequest.flush({ id: 'id', email: 'user@example.com' });
    await expect(requestResultPromise).resolves.toEqual({ id: 'id', email: 'user@example.com' });
    httpTestingController.expectNone('/api/auth/csrf');
  });

  it('treats only /me 401 as a confirmed guest', async () => {
    const requestResultPromise = firstValueFrom(authApiService.getCurrentUser());
    httpTestingController
      .expectOne('/api/auth/me')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await expect(requestResultPromise).resolves.toBeNull();
  });

  it.each([0, 500, 403])(
    'propagates /me failure %i without pretending the user is signed out',
    async (status) => {
      const requestResultPromise = firstValueFrom(authApiService.getCurrentUser());
      const requestFailureAssertion = expect(requestResultPromise).rejects.toMatchObject({
        status,
      });
      const httpRequest = httpTestingController.expectOne('/api/auth/me');
      if (status === 0) httpRequest.error(new ProgressEvent('error'));
      else httpRequest.flush({}, { status, statusText: 'Failure' });
      await requestFailureAssertion;
    },
  );

  it.each([
    null,
    {},
    { id: 1, email: 'user@example.com' },
    { id: '', email: 'user@example.com' },
    { id: 'id', email: '' },
  ])('rejects malformed login identity %j', async (identityResponseBody) => {
    const requestResultPromise = firstValueFrom(
      authApiService.loginUser({ email: 'user@example.com', password: 'password' }),
    );
    const requestFailureAssertion = expect(requestResultPromise).rejects.toThrow(
      'Unexpected authentication response',
    );
    flushCsrfBootstrap();
    httpTestingController
      .expectOne('/api/auth/login')
      .flush(identityResponseBody, { status: 200, statusText: 'OK' });
    await requestFailureAssertion;
  });

  it('prepares a current-identity CSRF token before logout and requires 204', async () => {
    const requestResultPromise = firstValueFrom(authApiService.logoutUser());
    httpTestingController.expectNone('/api/auth/logout');
    flushCsrfBootstrap();
    const httpRequest = httpTestingController.expectOne('/api/auth/logout');
    expect(httpRequest.request.timeout).toBe(15_000);
    expect(httpRequest.request.method).toBe('POST');
    expect(httpRequest.request.body).toBeNull();
    httpRequest.flush(null, { status: 204, statusText: 'No Content' });
    await expect(requestResultPromise).resolves.toBeUndefined();
  });

  it('does not submit login when bootstrap has an unexpected success status', async () => {
    const requestResultPromise = firstValueFrom(
      authApiService.loginUser({ email: 'user@example.com', password: 'password' }),
    );
    const requestFailureAssertion = expect(requestResultPromise).rejects.toThrow(
      'Unexpected CSRF bootstrap status',
    );
    httpTestingController.expectOne('/api/auth/csrf').flush({});
    await requestFailureAssertion;
    httpTestingController.expectNone('/api/auth/login');
  });

  it('does not treat a wrong logout success status as confirmed logout', async () => {
    const requestResultPromise = firstValueFrom(authApiService.logoutUser());
    const requestFailureAssertion = expect(requestResultPromise).rejects.toThrow(
      'Unexpected logout status',
    );
    flushCsrfBootstrap();
    httpTestingController.expectOne('/api/auth/logout').flush({});
    await requestFailureAssertion;
  });
});

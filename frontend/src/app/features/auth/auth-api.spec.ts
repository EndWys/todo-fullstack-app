import { HttpClient, provideHttpClient, withXsrfConfiguration } from '@angular/common/http';
import { DOCUMENT } from '@angular/common';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AuthApi } from './auth-api';

describe('AuthApi', () => {
  let api: AuthApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXsrfConfiguration({ cookieName: '__Host-TodoApp.Xsrf' })),
        provideHttpClientTesting(),
      ],
    });
    api = TestBed.inject(AuthApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('posts the exact DTO to the relative registration URL', async () => {
    const body = { email: 'Denis@example.com', password: '  correct horse  ' };
    const response = { id: 'user-id', email: body.email };
    const result = firstValueFrom(api.register(body));
    http.expectNone('/api/auth/register');
    http.expectOne('/api/auth/csrf').flush(null, { status: 204, statusText: 'No Content' });
    const request = http.expectOne('/api/auth/register');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    expect(request.request.timeout).toBe(15_000);
    request.flush(response, { status: 201, statusText: 'Created' });
    await expect(result).resolves.toEqual(response);
  });

  it.each([
    { status: 200, statusText: 'OK', body: { id: 'user-id', email: 'denis@example.com' } },
    { status: 201, statusText: 'Created', body: { email: 'denis@example.com' } },
  ])('rejects an unexpected success response: $status', async ({ status, statusText, body }) => {
    const result = firstValueFrom(
      api.register({ email: 'denis@example.com', password: 'password' }),
    );
    const assertion = expect(result).rejects.toThrow('Unexpected registration response');
    http.expectOne('/api/auth/csrf').flush(null, { status: 204, statusText: 'No Content' });
    http.expectOne('/api/auth/register').flush(body, { status, statusText });
    await assertion;
  });

  it('preserves HTTP errors for the page and does not automatically retry', async () => {
    const result = firstValueFrom(
      api.register({ email: 'denis@example.com', password: 'password' }),
    );
    const assertion = expect(result).rejects.toMatchObject({ status: 409 });
    http.expectOne('/api/auth/csrf').flush(null, { status: 204, statusText: 'No Content' });
    http
      .expectOne('/api/auth/register')
      .flush(
        { errors: { email: ['Email is already registered.'] } },
        { status: 409, statusText: 'Conflict' },
      );
    await assertion;
    http.expectNone('/api/auth/register');
  });

  it('reads the fresh request-token cookie after bootstrap and sends it in the POST header', async () => {
    // HttpTestingController does not apply Set-Cookie; simulate the browser's cookie visibility.
    const document = TestBed.inject(DOCUMENT);
    const cookie = vi.spyOn(document, 'cookie', 'get').mockReturnValue('');
    try {
      const result = firstValueFrom(
        api.register({ email: 'denis@example.com', password: 'password' }),
      );
      const bootstrap = http.expectOne('/api/auth/csrf');
      expect(bootstrap.request.method).toBe('GET');
      expect(bootstrap.request.headers.has('X-XSRF-TOKEN')).toBe(false);
      cookie.mockReturnValue('__Host-TodoApp.Xsrf=fresh-token');
      bootstrap.flush(null, { status: 204, statusText: 'No Content' });
      const request = http.expectOne('/api/auth/register');
      expect(request.request.headers.get('X-XSRF-TOKEN')).toBe('fresh-token');
      request.flush(
        { id: 'id', email: 'denis@example.com' },
        { status: 201, statusText: 'Created' },
      );
      await result;
    } finally {
      cookie.mockRestore();
    }
  });

  it('does not submit credentials if token preparation fails', async () => {
    const result = firstValueFrom(
      api.register({ email: 'denis@example.com', password: 'password' }),
    );
    const assertion = expect(result).rejects.toMatchObject({ status: 500 });
    http.expectOne('/api/auth/csrf').flush({}, { status: 500, statusText: 'Server Error' });
    await assertion;
    http.expectNone('/api/auth/register');
  });

  it('does not send the CSRF token to a different origin', async () => {
    const cookie = vi
      .spyOn(TestBed.inject(DOCUMENT), 'cookie', 'get')
      .mockReturnValue('__Host-TodoApp.Xsrf=private-token');
    try {
      const result = firstValueFrom(
        TestBed.inject(HttpClient).post('https://untrusted.invalid/action', {}),
      );
      const request = http.expectOne('https://untrusted.invalid/action');
      expect(request.request.headers.has('X-XSRF-TOKEN')).toBe(false);
      request.flush({});
      await result;
    } finally {
      cookie.mockRestore();
    }
  });

  it('does not automatically replay a POST rejected by CSRF validation', async () => {
    const result = firstValueFrom(
      api.register({ email: 'denis@example.com', password: 'password' }),
    );
    const assertion = expect(result).rejects.toMatchObject({ status: 400 });
    http.expectOne('/api/auth/csrf').flush(null, { status: 204, statusText: 'No Content' });
    http
      .expectOne('/api/auth/register')
      .flush(
        { code: 'csrf_validation_failed', title: 'CSRF validation failed.' },
        { status: 400, statusText: 'Bad Request' },
      );
    await assertion;
    http.expectNone('/api/auth/csrf');
    http.expectNone('/api/auth/register');
  });
});

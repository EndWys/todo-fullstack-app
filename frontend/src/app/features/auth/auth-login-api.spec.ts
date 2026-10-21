import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AuthApi } from './auth-api';

describe('AuthApi login and sessions', () => {
  let api: AuthApi;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(AuthApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function bootstrap() {
    http.expectOne('/api/auth/csrf').flush(null, { status: 204, statusText: 'No Content' });
  }

  it('prepares CSRF then sends login unchanged and reads only public identity fields', async () => {
    const body = { email: 'User@Example.com', password: '  password with spaces  ' };
    const result = firstValueFrom(api.login(body));
    http.expectNone('/api/auth/login');
    bootstrap();
    const request = http.expectOne('/api/auth/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ id: 'id', email: body.email, ignored: 'not stored' });
    await expect(result).resolves.toEqual({ id: 'id', email: body.email });
  });

  it('preserves login 401 rather than converting it into a guest success', async () => {
    const result = firstValueFrom(
      api.login({ email: 'user@example.com', password: 'wrong password' }),
    );
    const assertion = expect(result).rejects.toMatchObject({ status: 401 });
    bootstrap();
    http.expectOne('/api/auth/login').flush({}, { status: 401, statusText: 'Unauthorized' });
    await assertion;
  });

  it('restores identity with a non-cached GET without CSRF bootstrap', async () => {
    const result = firstValueFrom(api.me());
    const request = http.expectOne('/api/auth/me');
    expect(request.request.method).toBe('GET');
    expect(request.request.cache).toBe('no-store');
    request.flush({ id: 'id', email: 'user@example.com' });
    await expect(result).resolves.toEqual({ id: 'id', email: 'user@example.com' });
    http.expectNone('/api/auth/csrf');
  });

  it('treats only /me 401 as a confirmed guest', async () => {
    const result = firstValueFrom(api.me());
    http.expectOne('/api/auth/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    await expect(result).resolves.toBeNull();
  });

  it.each([0, 500, 403])(
    'propagates /me failure %i without pretending the user is signed out',
    async (status) => {
      const result = firstValueFrom(api.me());
      const assertion = expect(result).rejects.toMatchObject({ status });
      const request = http.expectOne('/api/auth/me');
      if (status === 0) request.error(new ProgressEvent('error'));
      else request.flush({}, { status, statusText: 'Failure' });
      await assertion;
    },
  );

  it.each([
    null,
    {},
    { id: 1, email: 'user@example.com' },
    { id: '', email: 'user@example.com' },
    { id: 'id', email: '' },
  ])('rejects malformed login identity %j', async (body) => {
    const result = firstValueFrom(api.login({ email: 'user@example.com', password: 'password' }));
    const assertion = expect(result).rejects.toThrow('Unexpected authentication response');
    bootstrap();
    http.expectOne('/api/auth/login').flush(body, { status: 200, statusText: 'OK' });
    await assertion;
  });

  it('prepares a current-identity CSRF token before logout and requires 204', async () => {
    const result = firstValueFrom(api.logout());
    http.expectNone('/api/auth/logout');
    bootstrap();
    const request = http.expectOne('/api/auth/logout');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    request.flush(null, { status: 204, statusText: 'No Content' });
    await expect(result).resolves.toBeUndefined();
  });

  it('does not submit login when bootstrap has an unexpected success status', async () => {
    const result = firstValueFrom(api.login({ email: 'user@example.com', password: 'password' }));
    const assertion = expect(result).rejects.toThrow('Unexpected CSRF bootstrap status');
    http.expectOne('/api/auth/csrf').flush({});
    await assertion;
    http.expectNone('/api/auth/login');
  });

  it('does not treat a wrong logout success status as confirmed logout', async () => {
    const result = firstValueFrom(api.logout());
    const assertion = expect(result).rejects.toThrow('Unexpected logout status');
    bootstrap();
    http.expectOne('/api/auth/logout').flush({});
    await assertion;
  });
});

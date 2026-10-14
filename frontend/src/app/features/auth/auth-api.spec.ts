import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AuthApi } from './auth-api';

describe('AuthApi', () => {
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

  it('posts the exact DTO to the relative registration URL', async () => {
    const body = { email: 'Denis@example.com', password: '  correct horse  ' };
    const response = { id: 'user-id', email: body.email };
    const result = firstValueFrom(api.register(body));
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
    http.expectOne('/api/auth/register').flush(body, { status, statusText });
    await assertion;
  });

  it('preserves HTTP errors for the page and does not automatically retry', async () => {
    const result = firstValueFrom(
      api.register({ email: 'denis@example.com', password: 'password' }),
    );
    const assertion = expect(result).rejects.toMatchObject({ status: 409 });
    http
      .expectOne('/api/auth/register')
      .flush(
        { errors: { email: ['Email is already registered.'] } },
        { status: 409, statusText: 'Conflict' },
      );
    await assertion;
    http.expectNone('/api/auth/register');
  });
});

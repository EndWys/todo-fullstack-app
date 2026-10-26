import { HttpClient, provideHttpClient, withXsrfConfiguration } from '@angular/common/http';
import { DOCUMENT } from '@angular/common';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AuthApiService } from '../auth-api.service';

describe('Auth XSRF HttpClient integration', () => {
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

  it('reads the fresh request-token cookie after bootstrap and sends it in the POST header', async () => {
    // HttpTestingController does not apply Set-Cookie; simulate the browser's cookie visibility.
    const browserDocument = TestBed.inject(DOCUMENT);
    const requestTokenCookieSpy = vi.spyOn(browserDocument, 'cookie', 'get').mockReturnValue('');
    try {
      const requestResultPromise = firstValueFrom(
        authApiService.registerUser({ email: 'denis@example.com', password: 'password' }),
      );
      const csrfBootstrapRequest = httpTestingController.expectOne('/api/auth/csrf');
      expect(csrfBootstrapRequest.request.method).toBe('GET');
      expect(csrfBootstrapRequest.request.headers.has('X-XSRF-TOKEN')).toBe(false);
      requestTokenCookieSpy.mockReturnValue('__Host-TodoApp.Xsrf=fresh-token');
      csrfBootstrapRequest.flush(null, { status: 204, statusText: 'No Content' });
      const httpRequest = httpTestingController.expectOne('/api/auth/register');
      expect(httpRequest.request.headers.get('X-XSRF-TOKEN')).toBe('fresh-token');
      httpRequest.flush(
        { id: 'id', email: 'denis@example.com' },
        { status: 201, statusText: 'Created' },
      );
      await requestResultPromise;
    } finally {
      requestTokenCookieSpy.mockRestore();
    }
  });

  it('does not send the CSRF token to a different origin', async () => {
    const requestTokenCookieSpy = vi
      .spyOn(TestBed.inject(DOCUMENT), 'cookie', 'get')
      .mockReturnValue('__Host-TodoApp.Xsrf=private-token');
    try {
      const requestResultPromise = firstValueFrom(
        TestBed.inject(HttpClient).post('https://untrusted.invalid/action', {}),
      );
      const httpRequest = httpTestingController.expectOne('https://untrusted.invalid/action');
      expect(httpRequest.request.headers.has('X-XSRF-TOKEN')).toBe(false);
      httpRequest.flush({});
      await requestResultPromise;
    } finally {
      requestTokenCookieSpy.mockRestore();
    }
  });
});

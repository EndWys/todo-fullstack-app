import { enterAuthFormFieldValue } from './auth-form.test-helper';
import { flushAuthCsrfBootstrap } from './auth-csrf.test-helper';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withXsrfConfiguration } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { LoginPageComponent } from '../login-page/login-page.component';
import { AuthSessionService } from '../auth-session.service';

describe('LoginPageComponent HTTP and session integration', () => {
  let componentFixture: ComponentFixture<LoginPageComponent>;
  let hostElement: HTMLElement;
  let httpTestingController: HttpTestingController;
  const authenticatedUser = { id: 'id', email: 'User@Example.com' };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [LoginPageComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withXsrfConfiguration({ cookieName: '__Host-TodoApp.Xsrf' })),
        provideHttpClientTesting(),
      ],
    });
    httpTestingController = TestBed.inject(HttpTestingController);
    componentFixture = TestBed.createComponent(LoginPageComponent);
    await componentFixture.whenStable();
    hostElement = componentFixture.nativeElement;
  });
  afterEach(() => httpTestingController.verify());

  async function submitForm(password = '  correct horse battery staple  ') {
    await enterAuthFormFieldValue(
      componentFixture,
      hostElement,
      'login-email',
      '\u0085User@Example.com\u0085',
    );
    await enterAuthFormFieldValue(componentFixture, hostElement, 'login-password', password);
    hostElement.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await Promise.resolve();
    return httpTestingController.expectOne('/api/auth/csrf');
  }

  it('renders accessible labels and password-manager hints without initial errors', () => {
    expect(hostElement.querySelector('label[for="login-email"]')?.textContent).toBe('Email');
    expect(hostElement.querySelector('#login-email')?.getAttribute('autocomplete')).toBe(
      'username',
    );
    expect(hostElement.querySelector('#login-password')?.getAttribute('autocomplete')).toBe(
      'current-password',
    );
    expect(hostElement.querySelector('#login-password')?.getAttribute('type')).toBe('password');
    expect(hostElement.querySelector('.invalid-feedback')).toBeNull();
    expect(hostElement.querySelector('a[href="/register"]')).not.toBeNull();
  });

  it('marks missing fields and focuses the first invalid input without HTTP requests', async () => {
    const event = new Event('submit', { cancelable: true });
    hostElement.querySelector('form')!.dispatchEvent(event);
    await componentFixture.whenStable();
    expect(event.defaultPrevented).toBe(true);
    expect(hostElement.querySelector('#login-email-errors')?.textContent).toContain(
      'Email is required.',
    );
    expect(hostElement.querySelector('#login-password-errors')?.textContent).toContain(
      'Password is required.',
    );
    expect(document.activeElement?.id).toBe('login-email');
    httpTestingController.expectNone('/api/auth/csrf');
  });

  it('rejects malformed email locally and associates its error with the field', async () => {
    await enterAuthFormFieldValue(componentFixture, hostElement, 'login-email', 'not-an-email');
    hostElement.querySelector('#login-email')!.dispatchEvent(new FocusEvent('blur'));
    await componentFixture.whenStable();
    expect(hostElement.querySelector('#login-email')?.getAttribute('aria-describedby')).toBe(
      'login-email-errors',
    );
    expect(hostElement.querySelector('#login-email')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('waits for CSRF, sends unchanged credentials once, and presents the confirmed account', async () => {
    const requestTokenCookieSpy = vi
      .spyOn(TestBed.inject(DOCUMENT), 'cookie', 'get')
      .mockReturnValue('');
    try {
      const csrf = await submitForm();
      httpTestingController.expectNone('/api/auth/login');
      requestTokenCookieSpy.mockReturnValue('__Host-TodoApp.Xsrf=guest-token');
      csrf.flush(null, { status: 204, statusText: 'No Content' });
      const httpRequest = httpTestingController.expectOne('/api/auth/login');
      expect(httpRequest.request.body).toEqual({
        email: authenticatedUser.email,
        password: '  correct horse battery staple  ',
      });
      expect(httpRequest.request.headers.get('X-XSRF-TOKEN')).toBe('guest-token');
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      expect(hostElement.querySelector('fieldset')?.disabled).toBe(true);
      hostElement.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      httpTestingController.expectNone('/api/auth/csrf');
      httpRequest.flush(authenticatedUser);
      await componentFixture.whenStable();
      expect(hostElement.querySelector('form')).toBeNull();
      expect(hostElement.querySelector('[role="status"]')?.textContent).toContain(
        authenticatedUser.email,
      );
      expect(TestBed.inject(AuthSessionService).authenticatedUser()).toEqual(authenticatedUser);
      expect(document.activeElement?.id).toBe('login-title');
    } finally {
      requestTokenCookieSpy.mockRestore();
    }
  });

  it.each(['x', ' '.repeat(15), 'a'.repeat(300)])(
    'delegates password policy to the server without transforming %s',
    async (password) => {
      const csrf = await submitForm(password);
      csrf.flush(null, { status: 204, statusText: 'No Content' });
      const httpRequest = httpTestingController.expectOne('/api/auth/login');
      expect(httpRequest.request.body.password).toBe(password);
      httpRequest.flush(
        { errors: { password: ['Password is invalid.'] } },
        { status: 400, statusText: 'Bad Request' },
      );
      await componentFixture.whenStable();
      expect(hostElement.querySelector('#login-password-errors')?.textContent).toContain(
        'Password is invalid.',
      );
      expect(document.activeElement?.id).toBe('login-password');
    },
  );

  it('shows one generic 401 error, retains input, and allows explicit retry', async () => {
    const csrf = await submitForm();
    csrf.flush(null, { status: 204, statusText: 'No Content' });
    httpTestingController
      .expectOne('/api/auth/login')
      .flush({ detail: 'private account details' }, { status: 401, statusText: 'Unauthorized' });
    await componentFixture.whenStable();
    expect(hostElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Invalid email or password.',
    );
    expect(hostElement.textContent).not.toContain('private account details');
    expect(hostElement.querySelector<HTMLInputElement>('#login-password')?.value).toBe(
      '  correct horse battery staple  ',
    );
    hostElement.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await Promise.resolve();
    flushAuthCsrfBootstrap(httpTestingController);
    httpTestingController.expectOne('/api/auth/login').flush(authenticatedUser);
    await componentFixture.whenStable();
    expect(TestBed.inject(AuthSessionService).authenticatedUser()).toEqual(authenticatedUser);
  });

  it('does not retry CSRF failure and shows a safe retry message', async () => {
    const csrf = await submitForm();
    csrf.flush(null, { status: 204, statusText: 'No Content' });
    httpTestingController
      .expectOne('/api/auth/login')
      .flush({ code: 'csrf_validation_failed' }, { status: 400, statusText: 'Bad Request' });
    await componentFixture.whenStable();
    expect(hostElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Security verification failed',
    );
    httpTestingController.expectNone('/api/auth/login');
    httpTestingController.expectNone('/api/auth/csrf');
  });

  it('recovers a lost login response by checking /me without resubmitting credentials', async () => {
    const csrf = await submitForm();
    csrf.flush(null, { status: 204, statusText: 'No Content' });
    httpTestingController.expectOne('/api/auth/login').error(new ProgressEvent('error'));
    await componentFixture.whenStable();
    const button = Array.from(hostElement.querySelectorAll('button')).find((item) =>
      item.textContent?.includes('Check session'),
    )!;
    button.click();
    httpTestingController.expectOne('/api/auth/me').flush(authenticatedUser);
    await componentFixture.whenStable();
    expect(hostElement.querySelector('[role="status"]')?.textContent).toContain(
      authenticatedUser.email,
    );
    httpTestingController.expectNone('/api/auth/login');
  });

  it('uses a new CSRF bootstrap for logout and returns to a cleared password form', async () => {
    const requestTokenCookieSpy = vi
      .spyOn(TestBed.inject(DOCUMENT), 'cookie', 'get')
      .mockReturnValue('__Host-TodoApp.Xsrf=guest-token');
    try {
      const csrf = await submitForm();
      csrf.flush(null, { status: 204, statusText: 'No Content' });
      httpTestingController.expectOne('/api/auth/login').flush(authenticatedUser);
      await componentFixture.whenStable();
      hostElement.querySelector('button')!.click();
      requestTokenCookieSpy.mockReturnValue('__Host-TodoApp.Xsrf=signed-in-token');
      flushAuthCsrfBootstrap(httpTestingController);
      const logout = httpTestingController.expectOne('/api/auth/logout');
      expect(logout.request.headers.get('X-XSRF-TOKEN')).toBe('signed-in-token');
      logout.flush(null, { status: 204, statusText: 'No Content' });
      await componentFixture.whenStable();
      expect(hostElement.querySelector<HTMLInputElement>('#login-password')?.value).toBe('');
      expect(TestBed.inject(AuthSessionService).sessionState().status).toBe('anonymous');
    } finally {
      requestTokenCookieSpy.mockRestore();
    }
  });

  it('keeps session confirmation alive when navigating away from the form', async () => {
    const csrf = await submitForm();
    csrf.flush(null, { status: 204, statusText: 'No Content' });
    const httpRequest = httpTestingController.expectOne('/api/auth/login');
    componentFixture.destroy();
    expect(httpRequest.cancelled).toBe(false);
    httpRequest.flush(authenticatedUser);
    await vi.waitFor(() =>
      expect(TestBed.inject(AuthSessionService).authenticatedUser()).toEqual(authenticatedUser),
    );
  });
});

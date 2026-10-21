import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withXsrfConfiguration } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { Login } from './login';
import { AuthSession } from '../auth-session';

describe('Login form', () => {
  let fixture: ComponentFixture<Login>;
  let element: HTMLElement;
  let http: HttpTestingController;
  const user = { id: 'id', email: 'User@Example.com' };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        provideHttpClient(withXsrfConfiguration({ cookieName: '__Host-TodoApp.Xsrf' })),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Login);
    await fixture.whenStable();
    element = fixture.nativeElement;
  });
  afterEach(() => http.verify());

  async function enter(id: string, value: string) {
    const input = element.querySelector<HTMLInputElement>(`#${id}`)!;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
  }
  async function submitForm(password = '  correct horse battery staple  ') {
    await enter('login-email', '\u0085User@Example.com\u0085');
    await enter('login-password', password);
    element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await Promise.resolve();
    return http.expectOne('/api/auth/csrf');
  }
  function bootstrap() {
    http.expectOne('/api/auth/csrf').flush(null, { status: 204, statusText: 'No Content' });
  }

  it('renders accessible labels and password-manager hints without initial errors', () => {
    expect(element.querySelector('label[for="login-email"]')?.textContent).toBe('Email');
    expect(element.querySelector('#login-email')?.getAttribute('autocomplete')).toBe('username');
    expect(element.querySelector('#login-password')?.getAttribute('autocomplete')).toBe(
      'current-password',
    );
    expect(element.querySelector('#login-password')?.getAttribute('type')).toBe('password');
    expect(element.querySelector('.invalid-feedback')).toBeNull();
    expect(element.querySelector('a[href="/register"]')).not.toBeNull();
  });

  it('marks missing fields and focuses the first invalid input without HTTP requests', async () => {
    const event = new Event('submit', { cancelable: true });
    element.querySelector('form')!.dispatchEvent(event);
    await fixture.whenStable();
    expect(event.defaultPrevented).toBe(true);
    expect(element.querySelector('#login-email-errors')?.textContent).toContain(
      'Email is required.',
    );
    expect(element.querySelector('#login-password-errors')?.textContent).toContain(
      'Password is required.',
    );
    expect(document.activeElement?.id).toBe('login-email');
    http.expectNone('/api/auth/csrf');
  });

  it('rejects malformed email locally and associates its error with the field', async () => {
    await enter('login-email', 'not-an-email');
    element.querySelector('#login-email')!.dispatchEvent(new FocusEvent('blur'));
    await fixture.whenStable();
    expect(element.querySelector('#login-email')?.getAttribute('aria-describedby')).toBe(
      'login-email-errors',
    );
    expect(element.querySelector('#login-email')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('waits for CSRF, sends unchanged credentials once, and presents the confirmed account', async () => {
    const cookie = vi.spyOn(TestBed.inject(DOCUMENT), 'cookie', 'get').mockReturnValue('');
    try {
      const csrf = await submitForm();
      http.expectNone('/api/auth/login');
      cookie.mockReturnValue('__Host-TodoApp.Xsrf=guest-token');
      csrf.flush(null, { status: 204, statusText: 'No Content' });
      const request = http.expectOne('/api/auth/login');
      expect(request.request.body).toEqual({
        email: user.email,
        password: '  correct horse battery staple  ',
      });
      expect(request.request.headers.get('X-XSRF-TOKEN')).toBe('guest-token');
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      expect(element.querySelector('fieldset')?.disabled).toBe(true);
      element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      http.expectNone('/api/auth/csrf');
      request.flush(user);
      await fixture.whenStable();
      expect(element.querySelector('form')).toBeNull();
      expect(element.querySelector('[role="status"]')?.textContent).toContain(user.email);
      expect(TestBed.inject(AuthSession).user()).toEqual(user);
      expect(document.activeElement?.id).toBe('login-title');
    } finally {
      cookie.mockRestore();
    }
  });

  it.each(['x', ' '.repeat(15), 'a'.repeat(300)])(
    'delegates password policy to the server without transforming %s',
    async (password) => {
      const csrf = await submitForm(password);
      csrf.flush(null, { status: 204, statusText: 'No Content' });
      const request = http.expectOne('/api/auth/login');
      expect(request.request.body.password).toBe(password);
      request.flush(
        { errors: { password: ['Password is invalid.'] } },
        { status: 400, statusText: 'Bad Request' },
      );
      await fixture.whenStable();
      expect(element.querySelector('#login-password-errors')?.textContent).toContain(
        'Password is invalid.',
      );
      expect(document.activeElement?.id).toBe('login-password');
    },
  );

  it('shows one generic 401 error, retains input, and allows explicit retry', async () => {
    const csrf = await submitForm();
    csrf.flush(null, { status: 204, statusText: 'No Content' });
    http
      .expectOne('/api/auth/login')
      .flush({ detail: 'private account details' }, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Invalid email or password.',
    );
    expect(element.textContent).not.toContain('private account details');
    expect(element.querySelector<HTMLInputElement>('#login-password')?.value).toBe(
      '  correct horse battery staple  ',
    );
    element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await Promise.resolve();
    bootstrap();
    http.expectOne('/api/auth/login').flush(user);
    await fixture.whenStable();
    expect(TestBed.inject(AuthSession).user()).toEqual(user);
  });

  it('does not retry CSRF failure and shows a safe retry message', async () => {
    const csrf = await submitForm();
    csrf.flush(null, { status: 204, statusText: 'No Content' });
    http
      .expectOne('/api/auth/login')
      .flush({ code: 'csrf_validation_failed' }, { status: 400, statusText: 'Bad Request' });
    await fixture.whenStable();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Security verification failed',
    );
    http.expectNone('/api/auth/login');
    http.expectNone('/api/auth/csrf');
  });

  it('recovers a lost login response by checking /me without resubmitting credentials', async () => {
    const csrf = await submitForm();
    csrf.flush(null, { status: 204, statusText: 'No Content' });
    http.expectOne('/api/auth/login').error(new ProgressEvent('error'));
    await fixture.whenStable();
    const button = Array.from(element.querySelectorAll('button')).find((item) =>
      item.textContent?.includes('Check session'),
    )!;
    button.click();
    http.expectOne('/api/auth/me').flush(user);
    await fixture.whenStable();
    expect(element.querySelector('[role="status"]')?.textContent).toContain(user.email);
    http.expectNone('/api/auth/login');
  });

  it('uses a new CSRF bootstrap for logout and returns to a cleared password form', async () => {
    const cookie = vi
      .spyOn(TestBed.inject(DOCUMENT), 'cookie', 'get')
      .mockReturnValue('__Host-TodoApp.Xsrf=guest-token');
    try {
      const csrf = await submitForm();
      csrf.flush(null, { status: 204, statusText: 'No Content' });
      http.expectOne('/api/auth/login').flush(user);
      await fixture.whenStable();
      element.querySelector('button')!.click();
      cookie.mockReturnValue('__Host-TodoApp.Xsrf=signed-in-token');
      bootstrap();
      const logout = http.expectOne('/api/auth/logout');
      expect(logout.request.headers.get('X-XSRF-TOKEN')).toBe('signed-in-token');
      logout.flush(null, { status: 204, statusText: 'No Content' });
      await fixture.whenStable();
      expect(element.querySelector<HTMLInputElement>('#login-password')?.value).toBe('');
      expect(TestBed.inject(AuthSession).state().status).toBe('anonymous');
    } finally {
      cookie.mockRestore();
    }
  });

  it('keeps session confirmation alive when navigating away from the form', async () => {
    const csrf = await submitForm();
    csrf.flush(null, { status: 204, statusText: 'No Content' });
    const request = http.expectOne('/api/auth/login');
    fixture.destroy();
    expect(request.cancelled).toBe(false);
    request.flush(user);
    await vi.waitFor(() => expect(TestBed.inject(AuthSession).user()).toEqual(user));
  });
});

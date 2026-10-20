import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Register } from './register';

describe('Register', () => {
  let fixture: ComponentFixture<Register>;
  let element: HTMLElement;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [Register],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Register);
    await fixture.whenStable();
    element = fixture.nativeElement;
  });

  afterEach(() => http.verify());

  async function enterValue(id: string, value: string): Promise<HTMLInputElement> {
    const input = element.querySelector<HTMLInputElement>(`#${id}`)!;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    return input;
  }

  async function checkDetails(): Promise<void> {
    element
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    for (const bootstrap of http.match('/api/auth/csrf')) {
      bootstrap.flush(null, { status: 204, statusText: 'No Content' });
    }
    const requests = http.match('/api/auth/register');
    for (const request of requests) {
      request.flush(
        { id: 'user-id', email: 'denis@example.com' },
        { status: 201, statusText: 'Created' },
      );
    }
    await fixture.whenStable();
  }

  it('renders labelled fields without showing errors immediately', () => {
    expect(element.querySelector('h1')?.textContent).toBe('Create an account');
    expect(element.querySelector('label[for="email"]')?.textContent).toBe('Email');
    expect(element.querySelector('label[for="password"]')?.textContent).toBe('Password');
    expect(element.querySelector('#password')?.getAttribute('type')).toBe('password');
    expect(element.querySelector('#password')?.getAttribute('autocomplete')).toBe('new-password');
    expect(element.querySelector('.invalid-feedback')).toBeNull();
    expect(element.querySelector('[role="status"]')).toBeNull();
  });

  it('shows required errors on submit and prevents native form navigation', async () => {
    const event = new Event('submit', { bubbles: true, cancelable: true });
    element.querySelector('form')!.dispatchEvent(event);
    await fixture.whenStable();

    expect(event.defaultPrevented).toBe(true);
    expect(element.querySelector('#email-errors')?.textContent).toContain('Email is required.');
    expect(element.querySelector('#password-errors')?.textContent).toContain(
      'Password is required.',
    );
    expect(element.querySelector('[role="status"]')).toBeNull();
  });

  it('shows email errors after blur and clears them when corrected', async () => {
    const input = await enterValue('email', 'not-an-email');
    expect(element.querySelector('#email-errors')).toBeNull();
    input.dispatchEvent(new FocusEvent('blur'));
    await fixture.whenStable();

    expect(element.querySelector('#email-errors')?.textContent).toContain('Enter a valid email');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('email-errors');

    await enterValue('email', 'denis@example.com');
    expect(element.querySelector('#email-errors')).toBeNull();
    expect(input.getAttribute('aria-invalid')).toBe('false');
  });

  it.each(['  Denis@Example.com  ', '\u0085Denis@Example.com\u0085'])(
    'trims backend-supported whitespace without changing case: %s',
    async (value) => {
      const input = await enterValue('email', value);
      input.dispatchEvent(new FocusEvent('blur'));
      await fixture.whenStable();

      expect(input.value).toBe('Denis@Example.com');
      expect(element.querySelector('#email-errors')).toBeNull();
    },
  );

  it.each([
    { name: '14 ASCII characters', password: 'a'.repeat(14), message: 'at least 15' },
    { name: '257 ASCII characters', password: 'a'.repeat(257), message: 'no more than 256' },
    { name: 'only spaces', password: ' '.repeat(15), message: 'only whitespace' },
    {
      name: 'Unicode whitespace',
      password: '\u0085\u00a0\u2003'.repeat(5),
      message: 'only whitespace',
    },
    { name: '14 emoji', password: '😀'.repeat(14), message: 'at least 15' },
    { name: '257 emoji', password: '😀'.repeat(257), message: 'no more than 256' },
  ])('rejects $name', async ({ password, message }) => {
    await enterValue('email', 'denis@example.com');
    await enterValue('password', password);
    await checkDetails();

    expect(element.querySelector('#password-errors')?.textContent).toContain(message);
    expect(element.querySelector('[role="status"]')).toBeNull();
  });

  it.each([
    { name: '15 ASCII characters', password: 'a'.repeat(15) },
    { name: '256 ASCII characters', password: 'a'.repeat(256) },
    { name: '15 emoji', password: '😀'.repeat(15) },
    { name: '256 emoji', password: '😀'.repeat(256) },
    { name: 'leading and trailing spaces', password: '  correct horse  ' },
    { name: 'a non-whitespace Unicode character', password: '\ufeff'.repeat(15) },
  ])('sends $name unchanged and clears it only after success', async ({ password }) => {
    await enterValue('email', 'denis@example.com');
    const input = await enterValue('password', password);
    element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await Promise.resolve();
    http.expectOne('/api/auth/csrf').flush(null, { status: 204, statusText: 'No Content' });
    const request = http.expectOne('/api/auth/register');
    expect(request.request.body.password).toBe(password);
    expect(input.value).toBe(password);
    expect(element.querySelector('#password-help')?.textContent).toContain(
      `Current length: ${[...password].length}.`,
    );
    request.flush(
      { id: 'user-id', email: 'denis@example.com' },
      { status: 201, statusText: 'Created' },
    );
    await fixture.whenStable();
    expect(input.value).toBe('');
    expect(element.querySelector('.invalid-feedback')).toBeNull();
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Account created');
  });

  it('does not accept malformed email when the password is valid', async () => {
    await enterValue('email', 'not-an-email');
    await enterValue('password', 'correct horse battery');
    await checkDetails();

    expect(element.querySelector('#email-errors')).not.toBeNull();
    expect(element.querySelector('[role="status"]')).toBeNull();
  });

  it('clears the success notice when values change', async () => {
    await enterValue('email', 'denis@example.com');
    await enterValue('password', 'correct horse battery');
    await checkDetails();
    expect(element.querySelector('[role="status"]')).not.toBeNull();

    await enterValue('password', 'short');
    expect(element.querySelector('[role="status"]')).toBeNull();
    element.querySelector('#password')!.dispatchEvent(new FocusEvent('blur'));
    await fixture.whenStable();
    expect(element.querySelector('#password-errors')?.textContent).toContain('at least 15');
  });

  async function startRegistration() {
    await enterValue('email', 'denis@example.com');
    await enterValue('password', 'correct horse battery');
    element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await Promise.resolve();
    http.expectOne('/api/auth/csrf').flush(null, { status: 204, statusText: 'No Content' });
    return http.expectOne('/api/auth/register');
  }

  it('sends one request and prevents duplicate submissions while pending', async () => {
    const request = await startRegistration();
    // Give Angular time to render without waiting for the pending HTTP task.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(element.querySelector('button')?.disabled).toBe(true);
    expect(element.querySelector('fieldset')?.disabled).toBe(true);
    expect(element.querySelector('[role="status"]')).toBeNull();
    element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    http.expectNone('/api/auth/register');

    request.flush(
      { id: 'user-id', email: 'denis@example.com' },
      { status: 201, statusText: 'Created' },
    );
    await fixture.whenStable();
    expect(element.querySelector('button')?.disabled).toBe(false);
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      'You are not signed in',
    );
  });

  it('maps server validation errors to both fields', async () => {
    const request = await startRegistration();
    request.flush(
      {
        errors: {
          email: ['Email address has an invalid format.'],
          password: ['Password is invalid.'],
        },
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await fixture.whenStable();

    expect(element.querySelector('#email-errors')?.textContent).toContain('invalid format');
    expect(element.querySelector('#password-errors')?.textContent).toContain('Password is invalid');
    expect(element.querySelector('[role="status"]')).toBeNull();
  });

  it('shows a duplicate email error and clears it when that field changes', async () => {
    const request = await startRegistration();
    request.flush(
      { errors: { email: ['Email is already registered.'] } },
      { status: 409, statusText: 'Conflict' },
    );
    await fixture.whenStable();
    expect(element.querySelector('#email-errors')?.textContent).toContain('already registered');

    await enterValue('email', 'another@example.com');
    expect(element.querySelector('#email-errors')).toBeNull();
    await checkDetails();
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Account created');
  });

  it.each([
    { status: 500, statusText: 'Internal Server Error', body: { detail: 'SQL internal secret' } },
    { status: 400, statusText: 'Bad Request', body: { errors: { email: 42 } } },
  ])('handles unexpected $status response without leaking technical details', async (response) => {
    const request = await startRegistration();
    request.flush(response.body, { status: response.status, statusText: response.statusText });
    await fixture.whenStable();

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Registration could not be confirmed',
    );
    expect(element.textContent).not.toContain('SQL internal secret');
    expect(element.querySelector('[role="status"]')).toBeNull();
    expect(element.querySelector<HTMLInputElement>('#password')?.value).toBe(
      'correct horse battery',
    );
  });

  it('allows retrying unchanged values after a network failure', async () => {
    const request = await startRegistration();
    request.error(new ProgressEvent('error'));
    await fixture.whenStable();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('could not be reached');

    await checkDetails();
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Account created');
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });

  it('cancels the outstanding subscription when the page is destroyed', async () => {
    const request = await startRegistration();
    fixture.destroy();
    await Promise.resolve();
    expect(request.cancelled).toBe(true);
  });
});

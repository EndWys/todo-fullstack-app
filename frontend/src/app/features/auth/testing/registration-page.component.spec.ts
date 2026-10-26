import { enterAuthFormFieldValue } from './auth-form.test-helper';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RegistrationPageComponent } from '../registration-page/registration-page.component';
import { provideRouter } from '@angular/router';

describe('RegistrationPageComponent HTTP integration', () => {
  let componentFixture: ComponentFixture<RegistrationPageComponent>;
  let hostElement: HTMLElement;
  let httpTestingController: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [RegistrationPageComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    httpTestingController = TestBed.inject(HttpTestingController);
    componentFixture = TestBed.createComponent(RegistrationPageComponent);
    await componentFixture.whenStable();
    hostElement = componentFixture.nativeElement;
  });

  afterEach(() => httpTestingController.verify());

  async function checkDetails(): Promise<void> {
    hostElement
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    for (const csrfBootstrapRequest of httpTestingController.match('/api/auth/csrf')) {
      csrfBootstrapRequest.flush(null, { status: 204, statusText: 'No Content' });
    }
    const requests = httpTestingController.match('/api/auth/register');
    for (const httpRequest of requests) {
      httpRequest.flush(
        { id: 'user-id', email: 'denis@example.com' },
        { status: 201, statusText: 'Created' },
      );
    }
    await componentFixture.whenStable();
  }

  it('renders labelled fields without showing errors immediately', () => {
    expect(
      hostElement.querySelector('#password-help')?.textContent?.replace(/\s+/g, ' ').trim(),
    ).toBe(
      'Use 15–256 characters. Spaces are allowed, but the password cannot be only whitespace. Current length: 0.',
    );
    expect(hostElement.querySelector('h1')?.textContent).toBe('Create an account');
    expect(hostElement.querySelector('label[for="email"]')?.textContent).toBe('Email');
    expect(hostElement.querySelector('label[for="password"]')?.textContent).toBe('Password');
    expect(hostElement.querySelector('#password')?.getAttribute('type')).toBe('password');
    expect(hostElement.querySelector('#password')?.getAttribute('autocomplete')).toBe(
      'new-password',
    );
    expect(hostElement.querySelector('.invalid-feedback')).toBeNull();
    expect(hostElement.querySelector('[role="status"]')).toBeNull();
  });

  it('shows required errors on submit and prevents native form navigation', async () => {
    const event = new Event('submit', { bubbles: true, cancelable: true });
    hostElement.querySelector('form')!.dispatchEvent(event);
    await componentFixture.whenStable();

    expect(event.defaultPrevented).toBe(true);
    expect(hostElement.querySelector('#email-errors')?.textContent).toContain('Email is required.');
    expect(hostElement.querySelector('#password-errors')?.textContent).toContain(
      'Password is required.',
    );
    expect(hostElement.querySelector('[role="status"]')).toBeNull();
  });

  it('shows email errors after blur and clears them when corrected', async () => {
    const input = await enterAuthFormFieldValue(
      componentFixture,
      hostElement,
      'email',
      'not-an-email',
    );
    expect(hostElement.querySelector('#email-errors')).toBeNull();
    input.dispatchEvent(new FocusEvent('blur'));
    await componentFixture.whenStable();

    expect(hostElement.querySelector('#email-errors')?.textContent).toContain(
      'Enter a valid email',
    );
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('email-errors');

    await enterAuthFormFieldValue(componentFixture, hostElement, 'email', 'denis@example.com');
    expect(hostElement.querySelector('#email-errors')).toBeNull();
    expect(input.getAttribute('aria-invalid')).toBe('false');
  });

  it.each(['  Denis@Example.com  ', '\u0085Denis@Example.com\u0085'])(
    'trims backend-supported whitespace without changing case: %s',
    async (value) => {
      const input = await enterAuthFormFieldValue(componentFixture, hostElement, 'email', value);
      input.dispatchEvent(new FocusEvent('blur'));
      await componentFixture.whenStable();

      expect(input.value).toBe('Denis@Example.com');
      expect(hostElement.querySelector('#email-errors')).toBeNull();
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
    await enterAuthFormFieldValue(componentFixture, hostElement, 'email', 'denis@example.com');
    await enterAuthFormFieldValue(componentFixture, hostElement, 'password', password);
    await checkDetails();

    expect(hostElement.querySelector('#password-errors')?.textContent).toContain(message);
    expect(hostElement.querySelector('[role="status"]')).toBeNull();
  });

  it.each([
    { name: '15 ASCII characters', password: 'a'.repeat(15) },
    { name: '256 ASCII characters', password: 'a'.repeat(256) },
    { name: '15 emoji', password: '😀'.repeat(15) },
    { name: '256 emoji', password: '😀'.repeat(256) },
    { name: 'leading and trailing spaces', password: '  correct horse  ' },
    { name: 'a non-whitespace Unicode character', password: '\ufeff'.repeat(15) },
  ])('sends $name unchanged and clears it only after success', async ({ password }) => {
    await enterAuthFormFieldValue(componentFixture, hostElement, 'email', 'denis@example.com');
    const input = await enterAuthFormFieldValue(
      componentFixture,
      hostElement,
      'password',
      password,
    );
    hostElement.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await Promise.resolve();
    httpTestingController
      .expectOne('/api/auth/csrf')
      .flush(null, { status: 204, statusText: 'No Content' });
    const httpRequest = httpTestingController.expectOne('/api/auth/register');
    expect(httpRequest.request.body.password).toBe(password);
    expect(input.value).toBe(password);
    expect(hostElement.querySelector('#password-help')?.textContent).toContain(
      `Current length: ${[...password].length}.`,
    );
    httpRequest.flush(
      { id: 'user-id', email: 'denis@example.com' },
      { status: 201, statusText: 'Created' },
    );
    await componentFixture.whenStable();
    expect(input.value).toBe('');
    expect(hostElement.querySelector('.invalid-feedback')).toBeNull();
    expect(hostElement.querySelector('[role="status"]')?.textContent).toContain('Account created');
  });

  it('does not accept malformed email when the password is valid', async () => {
    await enterAuthFormFieldValue(componentFixture, hostElement, 'email', 'not-an-email');
    await enterAuthFormFieldValue(
      componentFixture,
      hostElement,
      'password',
      'correct horse battery',
    );
    await checkDetails();

    expect(hostElement.querySelector('#email-errors')).not.toBeNull();
    expect(hostElement.querySelector('[role="status"]')).toBeNull();
  });

  it('clears the success notice when values change', async () => {
    await enterAuthFormFieldValue(componentFixture, hostElement, 'email', 'denis@example.com');
    await enterAuthFormFieldValue(
      componentFixture,
      hostElement,
      'password',
      'correct horse battery',
    );
    await checkDetails();
    expect(hostElement.querySelector('[role="status"]')).not.toBeNull();

    await enterAuthFormFieldValue(componentFixture, hostElement, 'password', 'short');
    expect(hostElement.querySelector('[role="status"]')).toBeNull();
    hostElement.querySelector('#password')!.dispatchEvent(new FocusEvent('blur'));
    await componentFixture.whenStable();
    expect(hostElement.querySelector('#password-errors')?.textContent).toContain('at least 15');
  });

  async function startRegistration() {
    await enterAuthFormFieldValue(componentFixture, hostElement, 'email', 'denis@example.com');
    await enterAuthFormFieldValue(
      componentFixture,
      hostElement,
      'password',
      'correct horse battery',
    );
    hostElement.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await Promise.resolve();
    httpTestingController
      .expectOne('/api/auth/csrf')
      .flush(null, { status: 204, statusText: 'No Content' });
    return httpTestingController.expectOne('/api/auth/register');
  }

  it('sends one request and prevents duplicate submissions while pending', async () => {
    const httpRequest = await startRegistration();
    // Give Angular time to render without waiting for the pending HTTP task.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(hostElement.querySelector('button')?.disabled).toBe(true);
    expect(hostElement.querySelector('fieldset')?.disabled).toBe(true);
    expect(hostElement.querySelector('[role="status"]')).toBeNull();
    hostElement.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    httpTestingController.expectNone('/api/auth/register');

    httpRequest.flush(
      { id: 'user-id', email: 'denis@example.com' },
      { status: 201, statusText: 'Created' },
    );
    await componentFixture.whenStable();
    expect(hostElement.querySelector('button')?.disabled).toBe(false);
    expect(hostElement.querySelector('[role="status"]')?.textContent).toContain(
      'Registration does not sign you in automatically',
    );
  });

  it('maps server validation errors to both fields', async () => {
    const httpRequest = await startRegistration();
    httpRequest.flush(
      {
        errors: {
          email: ['Email address has an invalid format.'],
          password: ['Password is invalid.'],
        },
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await componentFixture.whenStable();

    expect(hostElement.querySelector('#email-errors')?.textContent).toContain('invalid format');
    expect(hostElement.querySelector('#password-errors')?.textContent).toContain(
      'Password is invalid',
    );
    expect(hostElement.querySelector('[role="status"]')).toBeNull();
  });

  it('shows a duplicate email error and clears it when that field changes', async () => {
    const httpRequest = await startRegistration();
    httpRequest.flush(
      { errors: { email: ['Email is already registered.'] } },
      { status: 409, statusText: 'Conflict' },
    );
    await componentFixture.whenStable();
    expect(hostElement.querySelector('#email-errors')?.textContent).toContain('already registered');

    await enterAuthFormFieldValue(componentFixture, hostElement, 'email', 'another@example.com');
    expect(hostElement.querySelector('#email-errors')).toBeNull();
    await checkDetails();
    expect(hostElement.querySelector('[role="status"]')?.textContent).toContain('Account created');
  });

  it.each([
    { status: 500, statusText: 'Internal Server Error', body: { detail: 'SQL internal secret' } },
    { status: 400, statusText: 'Bad Request', body: { errors: { email: 42 } } },
  ])(
    'handles unexpected $status response without leaking technical details',
    async (registrationResponse) => {
      const httpRequest = await startRegistration();
      httpRequest.flush(registrationResponse.body, {
        status: registrationResponse.status,
        statusText: registrationResponse.statusText,
      });
      await componentFixture.whenStable();

      expect(hostElement.querySelector('[role="alert"]')?.textContent).toContain(
        'Registration could not be confirmed',
      );
      expect(hostElement.textContent).not.toContain('SQL internal secret');
      expect(hostElement.querySelector('[role="status"]')).toBeNull();
      expect(hostElement.querySelector<HTMLInputElement>('#password')?.value).toBe(
        'correct horse battery',
      );
    },
  );

  it('allows retrying unchanged values after a network failure', async () => {
    const httpRequest = await startRegistration();
    httpRequest.error(new ProgressEvent('error'));
    await componentFixture.whenStable();
    expect(hostElement.querySelector('[role="alert"]')?.textContent).toContain(
      'could not be reached',
    );

    await checkDetails();
    expect(hostElement.querySelector('[role="status"]')?.textContent).toContain('Account created');
    expect(hostElement.querySelector('[role="alert"]')).toBeNull();
  });

  it('cancels the outstanding subscription when the page is destroyed', async () => {
    const httpRequest = await startRegistration();
    componentFixture.destroy();
    await Promise.resolve();
    expect(httpRequest.cancelled).toBe(true);
  });
});

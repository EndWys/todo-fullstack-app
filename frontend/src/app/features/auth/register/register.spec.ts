import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Register } from './register';

describe('Register', () => {
  let fixture: ComponentFixture<Register>;
  let element: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [Register] });
    fixture = TestBed.createComponent(Register);
    await fixture.whenStable();
    element = fixture.nativeElement;
  });

  async function enterValue(id: string, value: string): Promise<HTMLInputElement> {
    const input = element.querySelector<HTMLInputElement>(`#${id}`)!;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    return input;
  }

  async function checkDetails(): Promise<void> {
    element.querySelector('form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
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
    expect(element.querySelector('#password-errors')?.textContent).toContain('Password is required.');
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

  it('trims email on blur without changing its case', async () => {
    const input = await enterValue('email', '  Denis@Example.com  ');
    input.dispatchEvent(new FocusEvent('blur'));
    await fixture.whenStable();

    expect(input.value).toBe('Denis@Example.com');
    expect(element.querySelector('#email-errors')).toBeNull();
  });

  it.each([
    { name: '14 ASCII characters', password: 'a'.repeat(14), message: 'at least 15' },
    { name: '257 ASCII characters', password: 'a'.repeat(257), message: 'no more than 256' },
    { name: 'only spaces', password: ' '.repeat(15), message: 'only whitespace' },
    { name: 'Unicode whitespace', password: '\u0085\u00a0\u2003'.repeat(5), message: 'only whitespace' },
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
  ])('accepts $name without changing the password', async ({ password }) => {
    await enterValue('email', 'denis@example.com');
    const input = await enterValue('password', password);
    await checkDetails();

    expect(element.querySelector('.invalid-feedback')).toBeNull();
    expect(element.querySelector('[role="status"]')?.textContent).toContain('No account has been created');
    expect(input.value).toBe(password);
    expect(element.querySelector('#password-help')?.textContent).toContain(
      `Current length: ${[...password].length}.`,
    );
  });

  it('does not accept malformed email when the password is valid', async () => {
    await enterValue('email', 'not-an-email');
    await enterValue('password', 'correct horse battery');
    await checkDetails();

    expect(element.querySelector('#email-errors')).not.toBeNull();
    expect(element.querySelector('[role="status"]')).toBeNull();
  });

  it('clears the local-validation notice when values change', async () => {
    await enterValue('email', 'denis@example.com');
    await enterValue('password', 'correct horse battery');
    await checkDetails();
    expect(element.querySelector('[role="status"]')).not.toBeNull();

    await enterValue('password', 'short');
    expect(element.querySelector('[role="status"]')).toBeNull();
    expect(element.querySelector('#password-errors')?.textContent).toContain('at least 15');
  });
});

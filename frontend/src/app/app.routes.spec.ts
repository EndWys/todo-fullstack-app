import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { Register } from './features/auth/register/register';
import { Login } from './features/auth/login/login';

describe('Application routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
    });
  });

  it('redirects the root URL to sign-in', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/', Login);

    expect(TestBed.inject(Router).url).toBe('/login');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent?.trim()).toBe('Sign in');
  });

  it('opens registration directly and sets the document title', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/register', Register);

    expect(page).toBeInstanceOf(Register);
    expect(TestBed.inject(Router).url).toBe('/register');
    expect(TestBed.inject(Title).getTitle()).toBe('Register — TodoApp');
  });

  it('opens login directly with its own document title', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/login', Login);
    expect(TestBed.inject(Title).getTitle()).toBe('Sign in — TodoApp');
  });
});

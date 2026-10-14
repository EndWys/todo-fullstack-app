import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { Register } from './features/auth/register/register';

describe('Application routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
    });
  });

  it('redirects the root URL to registration', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/', Register);

    expect(TestBed.inject(Router).url).toBe('/register');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Create an account');
  });

  it('opens registration directly and sets the document title', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/register', Register);

    expect(page).toBeInstanceOf(Register);
    expect(TestBed.inject(Router).url).toBe('/register');
    expect(TestBed.inject(Title).getTitle()).toBe('Register — TodoApp');
  });
});

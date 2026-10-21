import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

describe('App', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('renders the application shell and registration link', async () => {
    const fixture = TestBed.createComponent(App);
    await vi.waitFor(() =>
      TestBed.inject(HttpTestingController)
        .expectOne('/api/auth/me')
        .flush({}, { status: 401, statusText: 'Unauthorized' }),
    );
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('header')?.textContent).toContain('TodoApp');
    expect(element.querySelector('nav a[href="/register"]')).not.toBeNull();
    expect(element.querySelector('nav a[href="/login"]')).not.toBeNull();
    expect(element.querySelector('main router-outlet')).not.toBeNull();
  });

  it('provides a skip link to the main content', async () => {
    const fixture = TestBed.createComponent(App);
    await vi.waitFor(() =>
      TestBed.inject(HttpTestingController)
        .expectOne('/api/auth/me')
        .flush({}, { status: 401, statusText: 'Unauthorized' }),
    );
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('a[href="#main-content"]')).not.toBeNull();
    expect(element.querySelector('#main-content')?.getAttribute('tabindex')).toBe('-1');
  });

  it('restores identity on application startup and updates the account navigation', async () => {
    const fixture = TestBed.createComponent(App);
    await vi.waitFor(() =>
      TestBed.inject(HttpTestingController)
        .expectOne('/api/auth/me')
        .flush({ id: 'id', email: 'user@example.com' }),
    );
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('nav a[href="/login"]')?.textContent?.trim()).toBe('Account');
  });
});

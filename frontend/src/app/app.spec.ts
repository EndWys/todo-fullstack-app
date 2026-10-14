import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    });
  });

  it('renders the application shell and registration link', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('header')?.textContent).toContain('TodoApp');
    expect(element.querySelector('nav a')?.getAttribute('href')).toBe('/register');
    expect(element.querySelector('main router-outlet')).not.toBeNull();
  });

  it('provides a skip link to the main content', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('a[href="#main-content"]')).not.toBeNull();
    expect(element.querySelector('#main-content')?.getAttribute('tabindex')).toBe('-1');
  });
});

import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { appConfig } from '../../../app.config';
import { AuthSessionService } from '../../auth/auth-session.service';
import { TaskListPageComponent } from '../task-list-page/task-list-page.component';
import { sampleTaskSummary } from './task-list.test-data';

describe('Tasks pagination URL and HTTP integration', () => {
  let routerTestingHarness: RouterTestingHarness;
  let httpTestingController: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [...appConfig.providers, provideLocationMocks(), provideHttpClientTesting()],
    });
    httpTestingController = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    const restoration = TestBed.inject(AuthSessionService).restoreSession();
    httpTestingController
      .expectOne('/api/auth/me')
      .flush({ id: 'owner', email: 'owner@example.com' });
    await restoration;
    routerTestingHarness = await RouterTestingHarness.create();
  });

  afterEach(() => httpTestingController.verify());

  function getTaskPageElement(): HTMLElement {
    const element = routerTestingHarness.routeNativeElement;
    if (!element) throw new Error('Tasks route is not active.');
    return element;
  }

  async function expectPageRequest(page: number, pageSize: number): Promise<TestRequest> {
    let request: TestRequest | undefined;
    await vi.waitFor(() => {
      request = httpTestingController.expectOne(`/api/tasks?page=${page}&pageSize=${pageSize}`);
    });
    return request!;
  }

  async function flushPage(page: number, pageSize: number, totalCount = 61): Promise<void> {
    (await expectPageRequest(page, pageSize)).flush({
      items: [sampleTaskSummary],
      totalCount,
      page,
      pageSize,
    });
    await routerTestingHarness.fixture.whenStable();
  }

  async function openPage(
    url: string,
    page: number,
    pageSize: number,
  ): Promise<TaskListPageComponent> {
    const navigation = navigateToTaskPage(url);
    await flushPage(page, pageSize);
    return navigation;
  }

  async function navigateToTaskPage(url: string): Promise<TaskListPageComponent> {
    const navigation = routerTestingHarness.navigateByUrl(url, TaskListPageComponent);
    await vi.waitFor(() => {
      httpTestingController
        .expectOne('/api/auth/me')
        .flush({ id: 'owner', email: 'owner@example.com' });
    });
    return navigation;
  }

  function clickPageButton(label: string): void {
    const button = Array.from(
      getTaskPageElement().querySelectorAll<HTMLButtonElement>('app-task-list-pagination button'),
    ).find((candidate) => candidate.textContent?.trim() === label);
    if (!button) throw new Error(`Missing page button: ${label}`);
    button.click();
  }

  async function submitTaskDraft(): Promise<TestRequest> {
    const titleInput = getTaskPageElement().querySelector<HTMLInputElement>('#task-title')!;
    titleInput.value = 'Created on another page';
    titleInput.dispatchEvent(new Event('input', { bubbles: true }));
    await Promise.resolve();
    getTaskPageElement()
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => {
      httpTestingController
        .expectOne('/api/auth/csrf')
        .flush(null, { status: 204, statusText: 'No Content' });
    });
    return httpTestingController.expectOne('/api/tasks');
  }

  it('restores a non-default page from URL without an extra default request or CSRF bootstrap', async () => {
    await openPage('/tasks?page=3&pageSize=10', 3, 10);
    expect(router.url).toBe('/tasks?page=3&pageSize=10');
    expect(getTaskPageElement().textContent).toContain('Page 3 of 7');
    expect(getTaskPageElement().querySelector<HTMLSelectElement>('#task-page-size')?.value).toBe(
      '10',
    );
    httpTestingController.expectNone((request) => request.url === '/api/tasks');
    httpTestingController.expectNone('/api/auth/csrf');
  });

  it('navigates through URL, retains the component and form draft, and focuses the heading', async () => {
    const originalPage = await openPage('/tasks?page=2&pageSize=20', 2, 20);
    const titleInput = getTaskPageElement().querySelector<HTMLInputElement>('#task-title')!;
    titleInput.value = 'Unsaved task';
    titleInput.dispatchEvent(new Event('input', { bubbles: true }));
    await routerTestingHarness.fixture.whenStable();

    clickPageButton('Next');
    await flushPage(3, 20);
    expect(router.url).toBe('/tasks?page=3&pageSize=20');
    expect(routerTestingHarness.routeDebugElement?.componentInstance).toBe(originalPage);
    expect(getTaskPageElement().querySelector<HTMLInputElement>('#task-title')?.value).toBe(
      'Unsaved task',
    );
    expect(getTaskPageElement().textContent).toContain('Page 3 of 4');
    expect(document.activeElement?.id).toBe('tasks-title');
    httpTestingController.expectNone((request) => request.url === '/api/tasks');
  });

  it.each([10, 20, 50])(
    'changes size to %s and resets the page with one request',
    async (pageSize) => {
      await openPage('/tasks?page=3&pageSize=20', 3, 20);
      const select = getTaskPageElement().querySelector<HTMLSelectElement>('#task-page-size')!;
      if (pageSize === 20) {
        select.value = '10';
        select.dispatchEvent(new Event('change'));
        await flushPage(1, 10);
      }

      const currentSelect =
        getTaskPageElement().querySelector<HTMLSelectElement>('#task-page-size')!;
      currentSelect.value = String(pageSize);
      currentSelect.dispatchEvent(new Event('change'));
      await flushPage(1, pageSize);
      expect(router.url).toBe(`/tasks?page=1&pageSize=${pageSize}`);
      httpTestingController.expectNone((request) => request.url === '/api/tasks');
    },
  );

  it('restores page selection on Back and Forward', async () => {
    await openPage('/tasks?page=2&pageSize=20', 2, 20);
    router.initialNavigation();
    clickPageButton('Next');
    await flushPage(3, 20);
    TestBed.inject(Location).back();
    await flushPage(2, 20);
    expect(router.url).toBe('/tasks?page=2&pageSize=20');
    expect(getTaskPageElement().textContent).toContain('Page 2 of 4');

    TestBed.inject(Location).forward();
    await flushPage(3, 20);
    expect(router.url).toBe('/tasks?page=3&pageSize=20');
    expect(getTaskPageElement().textContent).toContain('Page 3 of 4');
  });

  it.each(['page=-1', 'page=', 'page=1&page=2', 'pageSize=15', 'page=2147483648', 'pages=2'])(
    'shows invalid URL %s without an API read, and allows explicit reset',
    async (query) => {
      await navigateToTaskPage(`/tasks?${query}`);
      await routerTestingHarness.fixture.whenStable();
      expect(getTaskPageElement().querySelector('[role="alert"]')).not.toBeNull();
      httpTestingController.expectNone((request) => request.url === '/api/tasks');
      const reset = Array.from(getTaskPageElement().querySelectorAll('button')).find(
        (button) => button.textContent?.trim() === 'Reset pagination',
      )!;
      reset.click();
      await flushPage(1, 20);
      expect(router.url).toBe('/tasks?page=1&pageSize=20');
      expect(getTaskPageElement().querySelector('[role="alert"]')).toBeNull();
    },
  );

  it('cancels a pending read when navigation makes parameters invalid', async () => {
    const initialNavigation = navigateToTaskPage('/tasks?page=2&pageSize=10');
    const pending = await expectPageRequest(2, 10);
    await initialNavigation;
    await routerTestingHarness.navigateByUrl('/tasks?page=0', TaskListPageComponent);
    await routerTestingHarness.fixture.whenStable();
    expect(pending.cancelled).toBe(true);
    expect(getTaskPageElement().querySelector('app-task-list-item')).toBeNull();
    httpTestingController.expectNone((request) => request.url === '/api/tasks');
  });

  it('shows an empty requested page without claiming that the whole list is empty', async () => {
    const navigation = navigateToTaskPage('/tasks?page=9&pageSize=20');
    (await expectPageRequest(9, 20)).flush({ items: [], totalCount: 21, page: 9, pageSize: 20 });
    await navigation;
    await routerTestingHarness.fixture.whenStable();
    expect(getTaskPageElement().textContent).toContain('No tasks on this page');
    expect(getTaskPageElement().textContent).not.toContain('No tasks to display.');
    clickPageButton('Last');
    await flushPage(2, 20, 21);
    expect(router.url).toBe('/tasks?page=2&pageSize=20');
  });

  it('refreshes the current page without changing URL or sending a mutation', async () => {
    await openPage('/tasks?page=2&pageSize=10', 2, 10);
    getTaskPageElement().querySelector<HTMLButtonElement>('button')!.click();
    await flushPage(2, 10);
    expect(router.url).toBe('/tasks?page=2&pageSize=10');
    httpTestingController.expectNone((request) => request.method !== 'GET');
  });

  it('moves to page one after confirmed creation, retaining size and refreshing exactly once', async () => {
    const page = await openPage('/tasks?page=2&pageSize=10', 2, 10);
    (await submitTaskDraft()).flush(
      { ...sampleTaskSummary, title: 'Created on another page', description: null },
      { status: 201, statusText: 'Created' },
    );
    await flushPage(1, 10);
    expect(router.url).toBe('/tasks?page=1&pageSize=10');
    expect(routerTestingHarness.routeDebugElement?.componentInstance).toBe(page);
    expect(getTaskPageElement().querySelector<HTMLInputElement>('#task-title')?.value).toBe('');
    expect(getTaskPageElement().textContent).toContain('Task created.');
    httpTestingController.expectNone((request) => request.url === '/api/tasks');
  });

  it('does not reset pagination or repeat POST after an unconfirmed creation', async () => {
    await openPage('/tasks?page=2&pageSize=10', 2, 10);
    (await submitTaskDraft()).error(new ProgressEvent('error'));
    await routerTestingHarness.fixture.whenStable();
    const refreshButton = Array.from(getTaskPageElement().querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Refresh list before retrying',
    )!;
    refreshButton.click();
    await flushPage(2, 10);
    expect(router.url).toBe('/tasks?page=2&pageSize=10');
    expect(getTaskPageElement().querySelector<HTMLInputElement>('#task-title')?.value).toBe(
      'Created on another page',
    );
    expect(getTaskPageElement().textContent).not.toContain('Task created.');
    httpTestingController.expectNone((request) => request.method === 'POST');
  });

  it('cancels an in-flight non-first page after confirmed creation', async () => {
    const navigation = navigateToTaskPage('/tasks?page=2&pageSize=10');
    const pendingPage = await expectPageRequest(2, 10);
    await navigation;
    (await submitTaskDraft()).flush(
      { ...sampleTaskSummary, title: 'Created on another page', description: null },
      { status: 201, statusText: 'Created' },
    );
    await flushPage(1, 10);
    expect(pendingPage.cancelled).toBe(true);
    expect(router.url).toBe('/tasks?page=1&pageSize=10');
    expect(getTaskPageElement().textContent).toContain('Task created.');
    httpTestingController.expectNone((request) => request.url === '/api/tasks');
  });

  it('retries a failed non-first page without resetting the selection', async () => {
    const navigation = navigateToTaskPage('/tasks?page=2&pageSize=10');
    (await expectPageRequest(2, 10)).flush(
      { detail: 'PRIVATE-DETAILS' },
      { status: 500, statusText: 'Failure' },
    );
    await navigation;
    await routerTestingHarness.fixture.whenStable();
    expect(getTaskPageElement().textContent).toContain('Tasks could not be loaded');
    expect(getTaskPageElement().textContent).not.toContain('PRIVATE-DETAILS');
    getTaskPageElement().querySelector<HTMLButtonElement>('button')!.click();
    await flushPage(2, 10);
    expect(router.url).toBe('/tasks?page=2&pageSize=10');
    expect(getTaskPageElement().querySelector('[role="alert"]')).toBeNull();
    httpTestingController.expectNone((request) => request.method === 'POST');
  });
});

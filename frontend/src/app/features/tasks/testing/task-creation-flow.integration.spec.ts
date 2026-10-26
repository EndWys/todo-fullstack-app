import { TestBed, ComponentFixture } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { AuthSessionService } from '../../auth/auth-session.service';
import { appConfig } from '../../../app.config';
import { TaskListPageComponent } from '../task-list-page/task-list-page.component';
import { createTaskListHttpResponseTestData, sampleTaskSummary } from './task-list.test-data';

describe('Task creation and list integration', () => {
  let componentFixture: ComponentFixture<TaskListPageComponent>;
  let httpTestingController: HttpTestingController;
  let hostElement: HTMLElement;
  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [...appConfig.providers, provideHttpClientTesting()],
    });
    httpTestingController = TestBed.inject(HttpTestingController);
    const restoration = TestBed.inject(AuthSessionService).restoreSession();
    httpTestingController
      .expectOne('/api/auth/me')
      .flush({ id: 'owner', email: 'user@example.com' });
    await restoration;
    componentFixture = TestBed.createComponent(TaskListPageComponent);
    hostElement = componentFixture.nativeElement;
  });
  afterEach(() => httpTestingController.verify());
  async function expectListRequest(): Promise<TestRequest> {
    let listRequest: TestRequest | undefined;
    await vi.waitFor(() => {
      listRequest = httpTestingController.expectOne('/api/tasks?page=1&pageSize=20');
    });
    return listRequest!;
  }
  async function submitDraft() {
    const titleInput = hostElement.querySelector<HTMLInputElement>('#task-title')!;
    titleInput.value = 'New task';
    titleInput.dispatchEvent(new Event('input', { bubbles: true }));
    await Promise.resolve();
    hostElement.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() =>
      httpTestingController
        .expectOne('/api/auth/csrf')
        .flush(null, { status: 204, statusText: 'No Content' }),
    );
    return httpTestingController.expectOne('/api/tasks');
  }
  it.each([false, true])(
    'refreshes after 201 even if an older GET is pending: %s',
    async (holdOldRead) => {
      const initialRead = await expectListRequest();
      if (!holdOldRead) {
        initialRead.flush(createTaskListHttpResponseTestData([]));
        await componentFixture.whenStable();
      }
      const creationRequest = await submitDraft();
      const createdSummary = { ...sampleTaskSummary, title: 'New task' };
      creationRequest.flush(
        { ...createdSummary, description: null },
        { status: 201, statusText: 'Created' },
      );
      const freshRead = await expectListRequest();
      if (holdOldRead) expect(initialRead.cancelled).toBe(true);
      freshRead.flush(createTaskListHttpResponseTestData([createdSummary]));
      await componentFixture.whenStable();
      expect(hostElement.querySelector('app-task-list-item h2')?.textContent).toBe('New task');
      expect(hostElement.querySelector<HTMLInputElement>('#task-title')?.value).toBe('');
      expect(hostElement.textContent).toContain('Task created.');
      expect(document.activeElement?.id).toBe('tasks-title');
      httpTestingController.expectNone('/api/auth/csrf');
    },
  );
  it('keeps creation confirmed when the subsequent list refresh fails', async () => {
    (await expectListRequest()).flush(createTaskListHttpResponseTestData([]));
    await componentFixture.whenStable();
    (await submitDraft()).flush(
      { ...sampleTaskSummary, description: null },
      { status: 201, statusText: 'Created' },
    );
    (await expectListRequest()).flush({}, { status: 500, statusText: 'Failure' });
    await componentFixture.whenStable();
    expect(hostElement.textContent).toContain('Task created.');
    expect(hostElement.textContent).toContain('Tasks could not be loaded');
    httpTestingController.expectNone('/api/tasks');
  });
  it('clears task UI after a creation 401 through the existing interceptor', async () => {
    (await expectListRequest()).flush(createTaskListHttpResponseTestData([]));
    await componentFixture.whenStable();
    (await submitDraft()).flush({}, { status: 401, statusText: 'Unauthorized' });
    await componentFixture.whenStable();
    expect(TestBed.inject(AuthSessionService).authenticatedUser()).toBeUndefined();
    expect(hostElement.querySelector('app-task-create-form')).toBeNull();
    expect(hostElement.querySelector('app-task-list-item')).toBeNull();
  });
});

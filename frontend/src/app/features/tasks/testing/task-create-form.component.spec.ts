import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthSessionService } from '../../auth/auth-session.service';
import { TaskCreateFormComponent } from '../task-create-form/task-create-form.component';
import { sampleTaskSummary } from './task-list.test-data';

describe('TaskCreateFormComponent HTTP integration', () => {
  let componentFixture: ComponentFixture<TaskCreateFormComponent>;
  let hostElement: HTMLElement;
  let httpTestingController: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpTestingController = TestBed.inject(HttpTestingController);
    const restoration = TestBed.inject(AuthSessionService).restoreSession();
    httpTestingController
      .expectOne('/api/auth/me')
      .flush({ id: 'owner', email: 'user@example.com' });
    await restoration;
    componentFixture = TestBed.createComponent(TaskCreateFormComponent);
    hostElement = componentFixture.nativeElement;
    await componentFixture.whenStable();
  });
  afterEach(() => httpTestingController.verify());

  async function enterField(fieldId: string, value: string) {
    const fieldElement = hostElement.querySelector<HTMLInputElement | HTMLSelectElement>(
      `#${fieldId}`,
    )!;
    fieldElement.value = value;
    fieldElement.dispatchEvent(new Event('input', { bubbles: true }));
    if (fieldElement instanceof HTMLSelectElement)
      fieldElement.dispatchEvent(new Event('change', { bubbles: true }));
    await componentFixture.whenStable();
  }
  function submitForm() {
    const submitEvent = new Event('submit', { cancelable: true, bubbles: true });
    hostElement.querySelector('form')!.dispatchEvent(submitEvent);
    return submitEvent;
  }
  async function startCreation() {
    await enterField('task-title', ' Learn Angular ');
    submitForm();
    await vi.waitFor(() =>
      httpTestingController
        .expectOne('/api/auth/csrf')
        .flush(null, { status: 204, statusText: 'No Content' }),
    );
    return httpTestingController.expectOne('/api/tasks');
  }

  it('renders labelled fields, hints, normal priority and no premature errors', () => {
    expect(hostElement.querySelector('label[for="task-title"]')?.textContent).toBe('Title');
    expect(hostElement.querySelector('label[for="task-description"]')).not.toBeNull();
    expect(hostElement.querySelector('label[for="task-priority"]')).not.toBeNull();
    expect(hostElement.querySelector<HTMLSelectElement>('#task-priority')?.value).toBe('normal');
    expect(hostElement.querySelector('#task-title-help')?.textContent).toContain('200');
    expect(hostElement.querySelector('#task-description-help')?.textContent).toContain('2000');
    expect(hostElement.querySelector('.invalid-feedback')).toBeNull();
  });
  it('rejects whitespace title locally and focuses the invalid field', async () => {
    await enterField('task-title', '\u0085  ');
    expect(submitForm().defaultPrevented).toBe(true);
    await componentFixture.whenStable();
    expect(hostElement.querySelector('#task-title-errors')?.textContent).toContain(
      'Title is required.',
    );
    expect(hostElement.querySelector('#task-title')?.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement?.id).toBe('task-title');
    httpTestingController.expectNone('/api/auth/csrf');
    httpTestingController.expectNone('/api/tasks');
  });
  it('emits creation only after 201, resets the form, and prevents duplicate submits', async () => {
    const createdSpy = vi.fn();
    componentFixture.componentInstance.taskCreated.subscribe(createdSpy);
    const creationRequest = await startCreation();
    await vi.waitFor(() => expect(hostElement.querySelector('fieldset')?.disabled).toBe(true));
    submitForm();
    httpTestingController.expectNone('/api/auth/csrf');
    httpTestingController.expectNone('/api/tasks');
    expect(createdSpy).not.toHaveBeenCalled();
    creationRequest.flush(
      { ...sampleTaskSummary, description: null },
      { status: 201, statusText: 'Created' },
    );
    await componentFixture.whenStable();
    expect(createdSpy).toHaveBeenCalledTimes(1);
    expect(hostElement.querySelector<HTMLInputElement>('#task-title')?.value).toBe('');
    expect(hostElement.querySelector<HTMLSelectElement>('#task-priority')?.value).toBe('normal');
    expect(hostElement.querySelector('[role="status"]')?.textContent).toContain('Task created.');
    await enterField('task-title', 'Next task');
    expect(hostElement.querySelector('[role="status"]')).toBeNull();
  });
  it('sends description and chosen priority, without client-only form fields', async () => {
    await enterField('task-title', ' Task with details ');
    await enterField('task-description', '  First line\nSecond line  ');
    await enterField('task-priority', 'high');
    submitForm();
    await vi.waitFor(() =>
      httpTestingController
        .expectOne('/api/auth/csrf')
        .flush(null, { status: 204, statusText: 'No Content' }),
    );
    const creationRequest = httpTestingController.expectOne('/api/tasks');
    expect(creationRequest.request.body).toEqual({
      title: 'Task with details',
      description: 'First line\nSecond line',
      priority: 'high',
    });
    creationRequest.flush(
      {
        ...sampleTaskSummary,
        title: 'Task with details',
        description: 'First line\nSecond line',
        priority: 'high',
      },
      { status: 201, statusText: 'Created' },
    );
    await componentFixture.whenStable();
  });

  it('maps all server field errors, retaining entered values and allowing correction', async () => {
    const creationRequest = await startCreation();
    creationRequest.flush(
      {
        errors: {
          title: ['Server title error.'],
          description: ['Server description error.'],
          priority: ['Server priority error.'],
          unknown: ['private'],
        },
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await componentFixture.whenStable();
    for (const field of ['title', 'description', 'priority'])
      expect(hostElement.querySelector(`#task-${field}-errors`)?.textContent).toContain(
        `Server ${field} error.`,
      );
    expect(hostElement.textContent).not.toContain('private');
    expect(hostElement.querySelector<HTMLInputElement>('#task-title')?.value).toBe(
      ' Learn Angular ',
    );
    await enterField('task-title', 'Corrected');
    expect(hostElement.querySelector('#task-title-errors')).toBeNull();
  });
  it('shows CSRF failures separately without replaying the request', async () => {
    (await startCreation()).flush(
      { code: 'csrf_validation_failed' },
      { status: 400, statusText: 'Bad Request' },
    );
    await componentFixture.whenStable();
    expect(hostElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Security verification failed',
    );
    expect(hostElement.querySelector('[role="status"]')).toBeNull();
    httpTestingController.expectNone('/api/tasks');
    httpTestingController.expectNone('/api/auth/csrf');
  });
  it.each([0, 500])(
    'preserves draft for unconfirmed failure %i and offers list refresh',
    async (status) => {
      const refreshSpy = vi.fn();
      componentFixture.componentInstance.taskListRefreshRequested.subscribe(refreshSpy);
      const creationRequest = await startCreation();
      if (status === 0) creationRequest.error(new ProgressEvent('error'));
      else creationRequest.flush({ detail: 'private details' }, { status, statusText: 'Failure' });
      await componentFixture.whenStable();
      expect(hostElement.querySelector('[role="alert"]')?.textContent).toContain(
        'could not be confirmed',
      );
      expect(hostElement.textContent).not.toContain('private details');
      expect(hostElement.querySelector<HTMLInputElement>('#task-title')?.value).toBe(
        ' Learn Angular ',
      );
      const refreshButton = Array.from(hostElement.querySelectorAll('button')).find((button) =>
        button.textContent?.includes('Refresh list'),
      )!;
      refreshButton.click();
      expect(refreshSpy).toHaveBeenCalledTimes(1);
      httpTestingController.expectNone('/api/tasks');
    },
  );
  it('clears the local draft without sending a request', async () => {
    await enterField('task-title', 'Draft');
    hostElement.querySelector<HTMLButtonElement>('button[type="button"]')!.click();
    await componentFixture.whenStable();
    expect(hostElement.querySelector<HTMLInputElement>('#task-title')?.value).toBe('');
    httpTestingController.expectNone('/api/auth/csrf');
  });
  it('cancels an outstanding POST on destruction without reporting success', async () => {
    const createdSpy = vi.fn();
    componentFixture.componentInstance.taskCreated.subscribe(createdSpy);
    const creationRequest = await startCreation();
    componentFixture.destroy();
    expect(creationRequest.cancelled).toBe(true);
    await Promise.resolve();
    expect(createdSpy).not.toHaveBeenCalled();
  });
});

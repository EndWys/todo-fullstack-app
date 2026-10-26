import { DOCUMENT } from '@angular/common';
import { provideHttpClient, withXsrfConfiguration } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthSessionService } from '../../auth/auth-session.service';
import { TaskCreationService } from '../task-create-form/task-creation.service';
import type { TaskCreationFormValue } from '../task-create-form/task-creation.models';
import { sampleTaskSummary } from './task-list.test-data';

describe('TaskCreationService HTTP integration', () => {
  let taskCreationService: TaskCreationService;
  let httpTestingController: HttpTestingController;
  const authenticatedUserSignal = signal<{ id: string; email: string } | undefined>(undefined);
  const authOperationInProgressSignal = signal(false);
  const authSessionServiceStub = {
    authenticatedUser: authenticatedUserSignal.asReadonly(),
    isAuthOperationInProgress: authOperationInProgressSignal.asReadonly(),
    sessionRevision: 0,
  } satisfies Pick<
    AuthSessionService,
    'authenticatedUser' | 'isAuthOperationInProgress' | 'sessionRevision'
  >;
  const taskCreationFormValue: TaskCreationFormValue = {
    title: '\u0085 New task \u0085',
    description: ' \r\n ',
    priority: 'high',
  };

  beforeEach(() => {
    authenticatedUserSignal.set({ id: 'owner', email: 'user@example.com' });
    authOperationInProgressSignal.set(false);
    authSessionServiceStub.sessionRevision = 0;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXsrfConfiguration({ cookieName: '__Host-TodoApp.Xsrf' })),
        provideHttpClientTesting(),
        TaskCreationService,
        { provide: AuthSessionService, useValue: authSessionServiceStub },
      ],
    });
    taskCreationService = TestBed.inject(TaskCreationService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });
  afterEach(() => httpTestingController.verify());

  it('bootstraps first, sends normalized DTO without owner, then validates 201', async () => {
    const requestTokenCookieSpy = vi
      .spyOn(TestBed.inject(DOCUMENT), 'cookie', 'get')
      .mockReturnValue('');
    try {
      const requestResultPromise = firstValueFrom(
        taskCreationService.createTask(taskCreationFormValue),
      );
      httpTestingController.expectNone('/api/tasks');
      const csrfBootstrapRequest = httpTestingController.expectOne('/api/auth/csrf');
      expect(csrfBootstrapRequest.request.timeout).toBe(15_000);
      expect(csrfBootstrapRequest.request.cache).toBe('no-store');
      requestTokenCookieSpy.mockReturnValue('__Host-TodoApp.Xsrf=fresh');
      csrfBootstrapRequest.flush(null, { status: 204, statusText: 'No Content' });
      const creationRequest = httpTestingController.expectOne('/api/tasks');
      expect(creationRequest.request.method).toBe('POST');
      expect(creationRequest.request.timeout).toBe(15_000);
      expect(creationRequest.request.body).toEqual({
        title: 'New task',
        description: null,
        priority: 'high',
      });
      expect(creationRequest.request.headers.get('X-XSRF-TOKEN')).toBe('fresh');
      expect(creationRequest.request.headers.has('Authorization')).toBe(false);
      creationRequest.flush(
        { ...sampleTaskSummary, description: null },
        { status: 201, statusText: 'Created' },
      );
      await expect(requestResultPromise).resolves.toEqual({
        ...sampleTaskSummary,
        description: null,
      });
    } finally {
      requestTokenCookieSpy.mockRestore();
    }
  });
  it.each([400, 401, 500])('does not submit after failed bootstrap %i', async (status) => {
    const requestResultPromise = firstValueFrom(
      taskCreationService.createTask(taskCreationFormValue),
    );
    const requestFailureAssertion = expect(requestResultPromise).rejects.toMatchObject({ status });
    httpTestingController.expectOne('/api/auth/csrf').flush({}, { status, statusText: 'Failure' });
    await requestFailureAssertion;
    httpTestingController.expectNone('/api/tasks');
  });
  it('does not accept a wrong bootstrap success status', async () => {
    const requestResultPromise = firstValueFrom(
      taskCreationService.createTask(taskCreationFormValue),
    );
    const requestFailureAssertion = expect(requestResultPromise).rejects.toThrow('Unexpected CSRF');
    httpTestingController.expectOne('/api/auth/csrf').flush({});
    await requestFailureAssertion;
    httpTestingController.expectNone('/api/tasks');
  });
  it.each([400, 401, 403, 500])('preserves POST error %i without retry', async (status) => {
    const requestResultPromise = firstValueFrom(
      taskCreationService.createTask(taskCreationFormValue),
    );
    const requestFailureAssertion = expect(requestResultPromise).rejects.toMatchObject({ status });
    httpTestingController
      .expectOne('/api/auth/csrf')
      .flush(null, { status: 204, statusText: 'No Content' });
    httpTestingController.expectOne('/api/tasks').flush({}, { status, statusText: 'Failure' });
    await requestFailureAssertion;
    httpTestingController.expectNone('/api/tasks');
    httpTestingController.expectNone('/api/auth/csrf');
  });
  it.each([200, 204])('rejects non-201 success %i', async (status) => {
    const requestResultPromise = firstValueFrom(
      taskCreationService.createTask(taskCreationFormValue),
    );
    const requestFailureAssertion = expect(requestResultPromise).rejects.toThrow(
      'Unexpected task creation status',
    );
    httpTestingController
      .expectOne('/api/auth/csrf')
      .flush(null, { status: 204, statusText: 'No Content' });
    httpTestingController
      .expectOne('/api/tasks')
      .flush(status === 204 ? null : { ...sampleTaskSummary, description: null }, {
        status,
        statusText: 'Success',
      });
    await requestFailureAssertion;
  });
  it('does not submit if identity changes during bootstrap', async () => {
    const requestResultPromise = firstValueFrom(
      taskCreationService.createTask(taskCreationFormValue),
    );
    const requestFailureAssertion = expect(requestResultPromise).rejects.toThrow('session changed');
    authSessionServiceStub.sessionRevision++;
    httpTestingController
      .expectOne('/api/auth/csrf')
      .flush(null, { status: 204, statusText: 'No Content' });
    await requestFailureAssertion;
    httpTestingController.expectNone('/api/tasks');
  });
  it('does not publish a result after the session changes while POST is pending', async () => {
    const requestResultPromise = firstValueFrom(
      taskCreationService.createTask(taskCreationFormValue),
    );
    const requestFailureAssertion = expect(requestResultPromise).rejects.toThrow('session changed');
    httpTestingController
      .expectOne('/api/auth/csrf')
      .flush(null, { status: 204, statusText: 'No Content' });
    const creationRequest = httpTestingController.expectOne('/api/tasks');
    authSessionServiceStub.sessionRevision++;
    creationRequest.flush(
      { ...sampleTaskSummary, description: null },
      { status: 201, statusText: 'Created' },
    );
    await requestFailureAssertion;
  });

  it('preserves transport failure without retrying POST', async () => {
    const requestResultPromise = firstValueFrom(
      taskCreationService.createTask(taskCreationFormValue),
    );
    const requestFailureAssertion = expect(requestResultPromise).rejects.toMatchObject({
      status: 0,
    });
    httpTestingController
      .expectOne('/api/auth/csrf')
      .flush(null, { status: 204, statusText: 'No Content' });
    httpTestingController.expectOne('/api/tasks').error(new ProgressEvent('error'));
    await requestFailureAssertion;
    httpTestingController.expectNone('/api/tasks');
    httpTestingController.expectNone('/api/auth/csrf');
  });

  it('rejects creation without confirmed identity or during auth mutation', async () => {
    authenticatedUserSignal.set(undefined);
    await expect(
      firstValueFrom(taskCreationService.createTask(taskCreationFormValue)),
    ).rejects.toThrow('session changed');
    authenticatedUserSignal.set({ id: 'owner', email: 'user@example.com' });
    authOperationInProgressSignal.set(true);
    await expect(
      firstValueFrom(taskCreationService.createTask(taskCreationFormValue)),
    ).rejects.toThrow('session changed');
    httpTestingController.expectNone('/api/auth/csrf');
  });
});

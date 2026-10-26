import { HttpClient, HttpResponse, HttpStatusCode } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { defer, map, Observable, switchMap } from 'rxjs';
import { CsrfTokenService } from '../../../core/security/csrf-token.service';
import { AuthSessionService } from '../../auth/auth-session.service';
import type {
  CreatedTask,
  CreateTaskRequest,
  TaskCreationFormValue,
  TaskCreationSessionContext,
} from './task-creation.models';
import { normalizeTaskText } from './task-text.normalizer';
import { parseTaskCreationResponse } from './task-creation-response.parser';

const TASK_CREATION_REQUEST_TIMEOUT_MS = 15_000;

@Service({ autoProvided: false })
export class TaskCreationService {
  private readonly httpClient = inject(HttpClient);
  private readonly csrfTokenService = inject(CsrfTokenService);
  private readonly authSessionService = inject(AuthSessionService);

  createTask(taskCreationFormValue: TaskCreationFormValue): Observable<CreatedTask> {
    // Capture identity on subscription, not when the cold observable is constructed.
    return defer(() => this.createTaskInCurrentSession(taskCreationFormValue));
  }

  private createTaskInCurrentSession(formValue: TaskCreationFormValue): Observable<CreatedTask> {
    const sessionContext = this.captureSessionContext();
    this.ensureSameSession(sessionContext);

    const creationRequest = this.createTaskRequest(formValue);

    return this.csrfTokenService.prepareCsrfToken().pipe(
      switchMap(() => this.sendCreationRequest(creationRequest, sessionContext)),
      map((creationResponse) => this.readCreationResponse(creationResponse, sessionContext)),
    );
  }

  private createTaskRequest(formValue: TaskCreationFormValue): CreateTaskRequest {
    const normalizedDescription = normalizeTaskText(formValue.description);
    let description: string | null = normalizedDescription;

    if (normalizedDescription.length === 0) {
      description = null;
    }

    return {
      title: normalizeTaskText(formValue.title),
      description,
      priority: formValue.priority,
    };
  }

  private sendCreationRequest(
    creationRequest: CreateTaskRequest,
    sessionContext: TaskCreationSessionContext,
  ): Observable<HttpResponse<unknown>> {
    this.ensureSameSession(sessionContext);

    return this.httpClient.post<unknown>('/api/tasks', creationRequest, {
      observe: 'response',
      timeout: TASK_CREATION_REQUEST_TIMEOUT_MS,
    });
  }

  private readCreationResponse(
    creationResponse: HttpResponse<unknown>,
    sessionContext: TaskCreationSessionContext,
  ): CreatedTask {
    this.ensureSameSession(sessionContext);

    if (creationResponse.status !== HttpStatusCode.Created) {
      throw new Error('Unexpected task creation status.');
    }

    return parseTaskCreationResponse(creationResponse.body);
  }

  private captureSessionContext(): TaskCreationSessionContext {
    return {
      sessionRevision: this.authSessionService.sessionRevision,
      ownerId: this.authSessionService.authenticatedUser()?.id,
    };
  }

  private ensureSameSession(sessionContext: TaskCreationSessionContext): void {
    // Reject an old draft after an observed identity change in this Angular instance.
    // This local revision check does not coordinate cookie changes in other tabs.
    if (this.isSameSession(sessionContext)) {
      return;
    }

    throw new Error('Task creation session changed.');
  }

  private isSameSession(sessionContext: TaskCreationSessionContext): boolean {
    if (!sessionContext.ownerId) {
      return false;
    }

    if (this.authSessionService.sessionRevision !== sessionContext.sessionRevision) {
      return false;
    }

    if (this.authSessionService.isAuthOperationInProgress()) {
      return false;
    }

    return this.authSessionService.authenticatedUser()?.id === sessionContext.ownerId;
  }
}

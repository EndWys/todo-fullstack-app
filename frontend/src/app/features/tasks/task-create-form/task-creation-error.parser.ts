import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import type {
  TaskCreationFailure,
  TaskCreationFieldError,
  TaskCreationFormValue,
} from './task-creation.models';

const TASK_CREATION_FIELD_NAMES = ['title', 'description', 'priority'] as const;

export function parseTaskCreationError(requestError: unknown): TaskCreationFailure {
  if (!(requestError instanceof HttpErrorResponse)) {
    return { kind: 'unconfirmed' };
  }

  if (requestError.status === HttpStatusCode.Unauthorized) {
    return { kind: 'session' };
  }

  if (requestError.status !== HttpStatusCode.BadRequest) {
    return { kind: 'unconfirmed' };
  }

  return parseBadRequestBody(requestError.error);
}

function parseBadRequestBody(responseBody: unknown): TaskCreationFailure {
  if (!isJsonObject(responseBody)) {
    return { kind: 'unconfirmed' };
  }

  if (responseBody['code'] === 'csrf_validation_failed') {
    return { kind: 'csrf' };
  }

  const fieldErrors = parseFieldErrors(responseBody['errors']);

  if (fieldErrors.length === 0) {
    return { kind: 'unconfirmed' };
  }

  return { kind: 'validation', errors: fieldErrors };
}

function parseFieldErrors(fieldErrorsPayload: unknown): TaskCreationFieldError[] {
  if (!isJsonObject(fieldErrorsPayload)) {
    return [];
  }

  const fieldErrors: TaskCreationFieldError[] = [];

  for (const fieldName of TASK_CREATION_FIELD_NAMES) {
    const fieldError = parseFieldError(fieldName, fieldErrorsPayload[fieldName]);

    if (fieldError !== undefined) {
      fieldErrors.push(fieldError);
    }
  }

  return fieldErrors;
}

function parseFieldError(
  fieldName: keyof TaskCreationFormValue,
  fieldMessages: unknown,
): TaskCreationFieldError | undefined {
  if (!Array.isArray(fieldMessages)) {
    return undefined;
  }

  if (!fieldMessages.every(isStringMessage)) {
    return undefined;
  }

  const message = fieldMessages.join(' ').trim();

  if (message.length === 0) {
    return undefined;
  }

  return { field: fieldName, message };
}

function isStringMessage(value: unknown): value is string {
  return typeof value === 'string';
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  if (value === null) {
    return false;
  }

  if (typeof value !== 'object') {
    return false;
  }

  return !Array.isArray(value);
}

import type { AuthFieldError } from './auth.models';

const AUTH_ERROR_FIELDS: readonly AuthFieldError['field'][] = ['email', 'password'];

export function parseAuthFieldErrors(responseBody: unknown): AuthFieldError[] {
  if (!isObjectValue(responseBody)) {
    return [];
  }

  const fieldErrorsPayload = responseBody['errors'];
  if (!isObjectValue(fieldErrorsPayload)) {
    return [];
  }

  const fieldErrors: AuthFieldError[] = [];

  for (const fieldName of AUTH_ERROR_FIELDS) {
    const fieldError = parseFieldError(fieldName, fieldErrorsPayload[fieldName]);
    if (fieldError) {
      fieldErrors.push(fieldError);
    }
  }

  return fieldErrors;
}

function parseFieldError(
  field: AuthFieldError['field'],
  fieldMessages: unknown,
): AuthFieldError | undefined {
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

  return { field, message };
}

function isStringMessage(message: unknown): message is string {
  return typeof message === 'string';
}

function isObjectValue(value: unknown): value is Record<string, unknown> {
  if (value === null) {
    return false;
  }

  return typeof value === 'object';
}

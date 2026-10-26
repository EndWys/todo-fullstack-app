import type { AuthFieldError } from './auth.models';

export function parseAuthFieldErrors(responseBody: unknown): AuthFieldError[] {
  if (
    typeof responseBody !== 'object' ||
    responseBody === null ||
    !('errors' in responseBody) ||
    typeof responseBody.errors !== 'object' ||
    responseBody.errors === null
  )
    return [];
  const fieldErrorsPayload = responseBody.errors as Record<string, unknown>;
  return (['email', 'password'] as const).flatMap((fieldName) => {
    const fieldMessages = fieldErrorsPayload[fieldName];
    if (
      !Array.isArray(fieldMessages) ||
      !fieldMessages.every((fieldMessage) => typeof fieldMessage === 'string')
    )
      return [];
    const fieldErrorMessage = fieldMessages.join(' ').trim();
    return fieldErrorMessage ? [{ field: fieldName, message: fieldErrorMessage }] : [];
  });
}

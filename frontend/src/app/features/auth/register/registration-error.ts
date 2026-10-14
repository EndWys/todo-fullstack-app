import { HttpErrorResponse } from '@angular/common/http';

export interface RegistrationFieldError {
  field: 'email' | 'password';
  message: string;
}

export type RegistrationFailure =
  | { kind: 'validation'; errors: RegistrationFieldError[] }
  | { kind: 'network' }
  | { kind: 'unexpected' };

export function parseRegistrationError(error: unknown): RegistrationFailure {
  if (!(error instanceof HttpErrorResponse)) {
    return { kind: 'unexpected' };
  }
  if (error.status === 0) {
    return { kind: 'network' };
  }
  if (error.status !== 400 && error.status !== 409) {
    return { kind: 'unexpected' };
  }

  const body: unknown = error.error;
  if (typeof body !== 'object' || body === null || !('errors' in body)) {
    return { kind: 'unexpected' };
  }
  const errors = body.errors;
  if (typeof errors !== 'object' || errors === null) {
    return { kind: 'unexpected' };
  }

  const fields = errors as Record<string, unknown>;
  const fieldErrors: RegistrationFieldError[] = (['email', 'password'] as const).flatMap(
    (field) => {
      const messages = fields[field];
      if (!Array.isArray(messages) || !messages.every((message) => typeof message === 'string')) {
        return [];
      }
      const message = messages.join(' ').trim();
      return message ? [{ field, message }] : [];
    },
  );

  return fieldErrors.length > 0
    ? { kind: 'validation', errors: fieldErrors }
    : { kind: 'unexpected' };
}

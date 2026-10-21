import { HttpErrorResponse } from '@angular/common/http';
import { AuthFieldError, readAuthFieldErrors } from '../auth-field-errors';

export type LoginFailure =
  | { kind: 'validation'; errors: AuthFieldError[] }
  | { kind: 'credentials' | 'csrf' | 'network' | 'unexpected' };

export function parseLoginError(error: unknown): LoginFailure {
  if (!(error instanceof HttpErrorResponse)) return { kind: 'unexpected' };
  if (error.status === 0) return { kind: 'network' };
  if (error.status === 401) return { kind: 'credentials' };
  if (error.status !== 400) return { kind: 'unexpected' };
  const body: unknown = error.error;
  if (
    typeof body === 'object' &&
    body !== null &&
    'code' in body &&
    body.code === 'csrf_validation_failed'
  ) {
    return { kind: 'csrf' };
  }
  const errors = readAuthFieldErrors(body);
  return errors.length ? { kind: 'validation', errors } : { kind: 'unexpected' };
}

export function loginFailureMessage(
  failure: Exclude<LoginFailure, { kind: 'validation' }>,
): string {
  switch (failure.kind) {
    case 'credentials':
      return 'Invalid email or password.';
    case 'csrf':
      return 'Security verification failed. Please try again.';
    case 'network':
      return 'The server could not be reached or the request timed out. Sign-in could not be confirmed. Check your session before trying again.';
    default:
      return 'Sign-in could not be confirmed. Check your session or try again.';
  }
}

import { HttpErrorResponse } from '@angular/common/http';
import { AuthFieldError, readAuthFieldErrors } from '../auth-field-errors';

export type RegistrationFieldError = AuthFieldError;

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

  const fieldErrors = readAuthFieldErrors(error.error);

  return fieldErrors.length > 0
    ? { kind: 'validation', errors: fieldErrors }
    : { kind: 'unexpected' };
}

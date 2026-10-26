import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { AUTH_TRANSPORT_ERROR_STATUS } from '../auth-http.constants';
import { parseAuthFieldErrors } from '../auth-field-errors.parser';
import type { RegistrationFailure } from './registration.models';

export function parseRegistrationError(requestError: unknown): RegistrationFailure {
  if (!(requestError instanceof HttpErrorResponse)) {
    return { kind: 'unexpected' };
  }
  if (requestError.status === AUTH_TRANSPORT_ERROR_STATUS) {
    return { kind: 'network' };
  }
  if (
    requestError.status !== HttpStatusCode.BadRequest &&
    requestError.status !== HttpStatusCode.Conflict
  ) {
    return { kind: 'unexpected' };
  }

  const fieldErrors = parseAuthFieldErrors(requestError.error);

  return fieldErrors.length > 0
    ? { kind: 'validation', errors: fieldErrors }
    : { kind: 'unexpected' };
}

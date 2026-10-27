import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { AUTH_TRANSPORT_ERROR_STATUS } from '../auth-http.constants';
import { parseAuthFieldErrors } from '../auth-field-errors.parser';
import type { LoginFailure } from './login.models';

export function parseLoginError(requestError: unknown): LoginFailure {
  if (!(requestError instanceof HttpErrorResponse)) {
    return { kind: 'unexpected' };
  }

  if (requestError.status === AUTH_TRANSPORT_ERROR_STATUS) {
    return { kind: 'network' };
  }

  if (requestError.status === HttpStatusCode.Unauthorized) {
    return { kind: 'credentials' };
  }

  if (requestError.status !== HttpStatusCode.BadRequest) {
    return { kind: 'unexpected' };
  }

  const responseBody: unknown = requestError.error;
  if (isCsrfFailure(responseBody)) {
    return { kind: 'csrf' };
  }
  const fieldErrors = parseAuthFieldErrors(responseBody);
  if (fieldErrors.length > 0) {
    return { kind: 'validation', errors: fieldErrors };
  }

  return { kind: 'unexpected' };
}

function isCsrfFailure(responseBody: unknown): boolean {
  if (responseBody === null) {
    return false;
  }

  if (typeof responseBody !== 'object') {
    return false;
  }

  if (!('code' in responseBody)) {
    return false;
  }

  return responseBody.code === 'csrf_validation_failed';
}

export function getLoginFailureMessage(
  loginFailure: Exclude<LoginFailure, { kind: 'validation' }>,
): string {
  switch (loginFailure.kind) {
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

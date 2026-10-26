import type { AuthUser } from './auth.models';

export function parseAuthUserResponse(responseBody: unknown): AuthUser {
  if (responseBody === null) {
    throwUnexpectedAuthResponse();
  }

  if (typeof responseBody !== 'object') {
    throwUnexpectedAuthResponse();
  }

  if (!('id' in responseBody)) {
    throwUnexpectedAuthResponse();
  }

  if (!('email' in responseBody)) {
    throwUnexpectedAuthResponse();
  }

  const id = readNonBlankIdentityField(responseBody.id);
  const email = readNonBlankIdentityField(responseBody.email);

  // Retain only the public identity fields, never arbitrary response properties.
  return Object.freeze({ id, email });
}

function readNonBlankIdentityField(value: unknown): string {
  if (typeof value !== 'string') {
    throwUnexpectedAuthResponse();
  }

  if (value.trim().length === 0) {
    throwUnexpectedAuthResponse();
  }

  return value;
}

function throwUnexpectedAuthResponse(): never {
  throw new Error('Unexpected authentication response.');
}

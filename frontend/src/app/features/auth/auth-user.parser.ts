import { AuthUser } from './auth.models';

export function parseAuthUserResponse(responseBody: unknown): AuthUser {
  if (
    typeof responseBody !== 'object' ||
    responseBody === null ||
    !('id' in responseBody) ||
    !('email' in responseBody) ||
    typeof responseBody.id !== 'string' ||
    responseBody.id.trim().length === 0 ||
    typeof responseBody.email !== 'string' ||
    responseBody.email.trim().length === 0
  ) {
    throw new Error('Unexpected authentication response.');
  }
  // Retain only the public identity fields, never arbitrary response properties.
  return Object.freeze({ id: responseBody.id, email: responseBody.email });
}

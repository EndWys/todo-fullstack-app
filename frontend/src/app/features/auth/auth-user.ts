import { AuthUser } from './auth.model';

export function readAuthUser(body: unknown): AuthUser {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('id' in body) ||
    !('email' in body) ||
    typeof body.id !== 'string' ||
    body.id.trim().length === 0 ||
    typeof body.email !== 'string' ||
    body.email.trim().length === 0
  ) {
    throw new Error('Unexpected authentication response.');
  }
  // Retain only the public identity fields, never arbitrary response properties.
  return Object.freeze({ id: body.id, email: body.email });
}

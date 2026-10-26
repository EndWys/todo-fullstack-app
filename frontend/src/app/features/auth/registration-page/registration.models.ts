import type { AuthFieldError } from '../auth.models';

export type RegistrationFieldError = AuthFieldError;

export type RegistrationFailure =
  | { kind: 'validation'; errors: RegistrationFieldError[] }
  | { kind: 'network' }
  | { kind: 'unexpected' };

import type { AuthFieldError } from '../auth.models';

export type RegistrationFieldError = AuthFieldError;

export type RegistrationFailure =
  | { readonly kind: 'validation'; readonly errors: readonly RegistrationFieldError[] }
  | { readonly kind: 'network' }
  | { readonly kind: 'unexpected' };

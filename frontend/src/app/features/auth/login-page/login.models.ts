import type { AuthFieldError } from '../auth.models';

export type LoginFailure =
  | { readonly kind: 'validation'; readonly errors: readonly AuthFieldError[] }
  | { readonly kind: 'credentials' | 'csrf' | 'network' | 'unexpected' };

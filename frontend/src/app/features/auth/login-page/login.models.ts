import type { AuthFieldError } from '../auth.models';

export type LoginFailure =
  | { kind: 'validation'; errors: AuthFieldError[] }
  | { kind: 'credentials' | 'csrf' | 'network' | 'unexpected' };

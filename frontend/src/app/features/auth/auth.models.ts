export interface RegisterRequest {
  readonly email: string;
  readonly password: string;
}

export interface RegisterResponse {
  readonly id: string;
  readonly email: string;
}

export interface LoginRequest {
  readonly email: string;
  readonly password: string;
}

export interface AuthUser {
  readonly id: string;
  readonly email: string;
}

export type AuthSessionState =
  | { readonly status: 'unknown' | 'loading' | 'anonymous' | 'error' }
  | { readonly status: 'authenticated'; readonly user: AuthUser };

export interface AuthFieldError {
  readonly field: 'email' | 'password';
  readonly message: string;
}

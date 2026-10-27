import { HttpClient, HttpErrorResponse, HttpResponse, HttpStatusCode } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { catchError, map, Observable, of, switchMap, throwError } from 'rxjs';
import type { AuthUser, LoginRequest, RegisterRequest, RegisterResponse } from './auth.models';
import { parseAuthUserResponse } from './auth-user.parser';
import { CsrfTokenService } from '../../core/security/csrf-token.service';
import { AUTH_REQUEST_TIMEOUT_MS } from './auth-http.constants';

@Service()
export class AuthApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly csrfTokenService = inject(CsrfTokenService);

  registerUser(registrationRequest: RegisterRequest) {
    // Refresh before each mutation: antiforgery tokens are tied to the current identity.
    // Starting the POST afterwards lets Angular's XSRF interceptor read the new cookie.
    return this.csrfTokenService.prepareCsrfToken().pipe(
      switchMap(() =>
        this.httpClient.post<RegisterResponse>('/api/auth/register', registrationRequest, {
          observe: 'response',
          timeout: AUTH_REQUEST_TIMEOUT_MS,
        }),
      ),
      map(readRegistrationResponse),
    );
  }

  loginUser(loginRequest: LoginRequest) {
    return this.csrfTokenService.prepareCsrfToken().pipe(
      switchMap(() =>
        this.httpClient.post<unknown>('/api/auth/login', loginRequest, {
          observe: 'response',
          timeout: AUTH_REQUEST_TIMEOUT_MS,
        }),
      ),
      map(readLoginResponse),
    );
  }

  getCurrentUser() {
    return this.httpClient
      .get<unknown>('/api/auth/me', {
        observe: 'response',
        timeout: AUTH_REQUEST_TIMEOUT_MS,
        cache: 'no-store',
      })
      .pipe(
        map(readSessionResponse),
        // Only an actual /me 401 confirms a guest. A network/500 error leaves session state unknown.
        catchError(handleSessionReadError),
      );
  }

  logoutUser() {
    return this.csrfTokenService.prepareCsrfToken().pipe(
      switchMap(() =>
        this.httpClient.post<void>('/api/auth/logout', null, {
          observe: 'response',
          timeout: AUTH_REQUEST_TIMEOUT_MS,
        }),
      ),
      map(ensureLogoutSucceeded),
    );
  }
}

function readRegistrationResponse(response: HttpResponse<RegisterResponse>): RegisterResponse {
  const responseBody = response.body;

  if (response.status !== HttpStatusCode.Created) {
    throw new Error('Unexpected registration response.');
  }

  if (!responseBody) {
    throw new Error('Unexpected registration response.');
  }

  if (typeof responseBody.id !== 'string') {
    throw new Error('Unexpected registration response.');
  }

  if (typeof responseBody.email !== 'string') {
    throw new Error('Unexpected registration response.');
  }

  return responseBody;
}

function readLoginResponse(response: HttpResponse<unknown>): AuthUser {
  if (response.status !== HttpStatusCode.Ok) {
    throw new Error('Unexpected login status.');
  }

  return parseAuthUserResponse(response.body);
}

function readSessionResponse(response: HttpResponse<unknown>): AuthUser {
  if (response.status !== HttpStatusCode.Ok) {
    throw new Error('Unexpected session status.');
  }

  return parseAuthUserResponse(response.body);
}

function handleSessionReadError(requestError: unknown): Observable<null> {
  if (requestError instanceof HttpErrorResponse) {
    if (requestError.status === HttpStatusCode.Unauthorized) {
      return of(null);
    }
  }

  return throwError(() => requestError);
}

function ensureLogoutSucceeded(response: HttpResponse<void>): void {
  if (response.status !== HttpStatusCode.NoContent) {
    throw new Error('Unexpected logout status.');
  }
}

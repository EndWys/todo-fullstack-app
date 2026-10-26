import { HttpClient, HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { catchError, map, of, switchMap, throwError } from 'rxjs';
import { LoginRequest, RegisterRequest, RegisterResponse } from './auth.models';
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
      map((registrationResponse) => {
        const registrationResponseBody = registrationResponse.body;
        if (
          registrationResponse.status !== HttpStatusCode.Created ||
          !registrationResponseBody ||
          typeof registrationResponseBody.id !== 'string' ||
          typeof registrationResponseBody.email !== 'string'
        ) {
          throw new Error('Unexpected registration response.');
        }
        return registrationResponseBody;
      }),
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
      map((loginResponse) => {
        if (loginResponse.status !== HttpStatusCode.Ok) throw new Error('Unexpected login status.');
        return parseAuthUserResponse(loginResponse.body);
      }),
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
        map((sessionResponse) => {
          if (sessionResponse.status !== HttpStatusCode.Ok)
            throw new Error('Unexpected session status.');
          return parseAuthUserResponse(sessionResponse.body);
        }),
        // Only an actual /me 401 confirms a guest. A network/500 error leaves session state unknown.
        catchError((requestError: unknown) =>
          requestError instanceof HttpErrorResponse &&
          requestError.status === HttpStatusCode.Unauthorized
            ? of(null)
            : throwError(() => requestError),
        ),
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
      map((logoutResponse) => {
        if (logoutResponse.status !== HttpStatusCode.NoContent)
          throw new Error('Unexpected logout status.');
      }),
    );
  }
}

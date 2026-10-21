import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { catchError, map, of, switchMap, throwError } from 'rxjs';
import { LoginRequest, RegisterRequest, RegisterResponse } from './auth.model';
import { readAuthUser } from './auth-user';

@Service()
export class AuthApi {
  private readonly http = inject(HttpClient);

  register(request: RegisterRequest) {
    // Refresh before each mutation: antiforgery tokens are tied to the current identity.
    // Starting the POST afterwards lets Angular's XSRF interceptor read the new cookie.
    return this.prepareCsrf().pipe(
      switchMap(() =>
        this.http.post<RegisterResponse>('/api/auth/register', request, {
          observe: 'response',
          timeout: 15_000,
        }),
      ),
      map((response) => {
        const body = response.body;
        if (
          response.status !== 201 ||
          !body ||
          typeof body.id !== 'string' ||
          typeof body.email !== 'string'
        ) {
          throw new Error('Unexpected registration response.');
        }
        return body;
      }),
    );
  }

  login(request: LoginRequest) {
    return this.prepareCsrf().pipe(
      switchMap(() =>
        this.http.post<unknown>('/api/auth/login', request, {
          observe: 'response',
          timeout: 15_000,
        }),
      ),
      map((response) => {
        if (response.status !== 200) throw new Error('Unexpected login status.');
        return readAuthUser(response.body);
      }),
    );
  }

  me() {
    return this.http
      .get<unknown>('/api/auth/me', { observe: 'response', timeout: 15_000, cache: 'no-store' })
      .pipe(
        map((response) => {
          if (response.status !== 200) throw new Error('Unexpected session status.');
          return readAuthUser(response.body);
        }),
        // Only an actual /me 401 confirms a guest. A network/500 error leaves session state unknown.
        catchError((error: unknown) =>
          error instanceof HttpErrorResponse && error.status === 401
            ? of(null)
            : throwError(() => error),
        ),
      );
  }

  logout() {
    return this.prepareCsrf().pipe(
      switchMap(() =>
        this.http.post<void>('/api/auth/logout', null, { observe: 'response', timeout: 15_000 }),
      ),
      map((response) => {
        if (response.status !== 204) throw new Error('Unexpected logout status.');
      }),
    );
  }

  private prepareCsrf() {
    return this.http
      .get<void>('/api/auth/csrf', { observe: 'response', timeout: 15_000, cache: 'no-store' })
      .pipe(
        map((response) => {
          if (response.status !== 204) throw new Error('Unexpected CSRF bootstrap status.');
        }),
      );
  }
}

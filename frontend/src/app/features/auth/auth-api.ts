import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, switchMap } from 'rxjs';
import { RegisterRequest, RegisterResponse } from './auth.model';

@Service()
export class AuthApi {
  private readonly http = inject(HttpClient);

  register(request: RegisterRequest) {
    // Refresh before each mutation: antiforgery tokens are tied to the current identity.
    // Starting the POST afterwards lets Angular's XSRF interceptor read the new cookie.
    return this.http.get<void>('/api/auth/csrf', { timeout: 15_000 }).pipe(
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
}

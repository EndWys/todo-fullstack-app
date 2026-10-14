import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map } from 'rxjs';
import { RegisterRequest, RegisterResponse } from './auth.model';

@Service()
export class AuthApi {
  private readonly http = inject(HttpClient);

  register(request: RegisterRequest) {
    return this.http
      .post<RegisterResponse>('/api/auth/register', request, {
        observe: 'response',
        timeout: 15_000,
      })
      .pipe(
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

import { HttpClient, HttpResponse, HttpStatusCode } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map } from 'rxjs';

const CSRF_REQUEST_TIMEOUT_MS = 15_000;

@Service()
export class CsrfTokenService {
  private readonly httpClient = inject(HttpClient);

  prepareCsrfToken() {
    // Tokens are identity-bound. Finish bootstrap before subscribing to the mutation,
    // so Angular's XSRF interceptor reads the refreshed request-token cookie.
    return this.httpClient
      .get<void>('/api/auth/csrf', {
        observe: 'response',
        timeout: CSRF_REQUEST_TIMEOUT_MS,
        cache: 'no-store',
      })
      .pipe(map((csrfResponse) => this.ensureBootstrapSucceeded(csrfResponse)));
  }

  private ensureBootstrapSucceeded(csrfResponse: HttpResponse<void>): void {
    if (csrfResponse.status !== HttpStatusCode.NoContent) {
      throw new Error('Unexpected CSRF bootstrap status.');
    }
  }
}

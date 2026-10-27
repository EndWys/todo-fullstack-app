import type { HttpTestingController } from '@angular/common/http/testing';

export function flushAuthCsrfBootstrap(httpTestingController: HttpTestingController): void {
  httpTestingController
    .expectOne('/api/auth/csrf')
    .flush(null, { status: 204, statusText: 'No Content' });
}

import { HttpErrorResponse, HttpInterceptorFn, HttpStatusCode } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthSessionService } from './auth-session.service';

export const sessionExpiryInterceptor: HttpInterceptorFn = (httpRequest, nextHttpHandler) => {
  const requestPath = httpRequest.url.split(/[?#]/, 1)[0];
  // Only the relative, protected Tasks API. Login's credential 401 and third-party
  // responses must not sign the user out or redirect them.
  if (!isProtectedTasksPath(requestPath)) {
    return nextHttpHandler(httpRequest);
  }

  const authSessionService = inject(AuthSessionService);
  const router = inject(Router);
  const requestSessionRevision = authSessionService.sessionRevision;

  return nextHttpHandler(httpRequest).pipe(
    catchError((responseError: unknown) => {
      handleProtectedRequestFailure(
        responseError,
        requestSessionRevision,
        authSessionService,
        router,
      );

      // Preserve the original failure for the feature; never retry a mutation automatically.
      return throwError(() => responseError);
    }),
  );
};

function isProtectedTasksPath(requestPath: string): boolean {
  return requestPath === '/api/tasks' || requestPath.startsWith('/api/tasks/');
}

function handleProtectedRequestFailure(
  responseError: unknown,
  requestSessionRevision: number,
  authSessionService: AuthSessionService,
  router: Router,
): void {
  if (!(responseError instanceof HttpErrorResponse)) {
    return;
  }

  if (responseError.status !== HttpStatusCode.Unauthorized) {
    return;
  }

  if (!authSessionService.expireSessionIfCurrent(requestSessionRevision)) {
    return;
  }

  redirectActiveTasksPage(router);
}

function redirectActiveTasksPage(router: Router): void {
  const isTasksPageActive = router.isActive('/tasks', {
    paths: 'subset',
    queryParams: 'ignored',
    fragment: 'ignored',
    matrixParams: 'ignored',
  });

  if (!isTasksPageActive) {
    return;
  }

  void router.navigate(['/login'], {
    replaceUrl: true,
    queryParams: { reason: 'session-ended' },
  });
}

import { HttpErrorResponse, HttpInterceptorFn, HttpStatusCode } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthSessionService } from './auth-session.service';

export const sessionExpiryInterceptor: HttpInterceptorFn = (httpRequest, nextHttpHandler) => {
  const requestPath = httpRequest.url.split(/[?#]/, 1)[0];
  // Only the relative, protected Tasks API. Login's credential 401 and third-party
  // responses must not sign the user out or redirect them.
  if (requestPath !== '/api/tasks' && !requestPath.startsWith('/api/tasks/'))
    return nextHttpHandler(httpRequest);

  const authSessionService = inject(AuthSessionService);
  const router = inject(Router);
  const requestSessionRevision = authSessionService.sessionRevision;
  return nextHttpHandler(httpRequest).pipe(
    catchError((responseError: unknown) => {
      if (
        responseError instanceof HttpErrorResponse &&
        responseError.status === HttpStatusCode.Unauthorized &&
        authSessionService.expireSessionIfCurrent(requestSessionRevision)
      ) {
        if (
          router.isActive('/tasks', {
            paths: 'subset',
            queryParams: 'ignored',
            fragment: 'ignored',
            matrixParams: 'ignored',
          })
        ) {
          void router.navigate(['/login'], {
            replaceUrl: true,
            queryParams: { reason: 'session-ended' },
          });
        }
      }
      // Preserve the original failure for the feature; never retry a mutation automatically.
      return throwError(() => responseError);
    }),
  );
};

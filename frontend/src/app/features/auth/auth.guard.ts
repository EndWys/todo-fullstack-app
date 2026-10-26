import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthSessionService } from './auth-session.service';

export const authGuard: CanActivateFn = async () => {
  const authSessionService = inject(AuthSessionService);
  const router = inject(Router);
  // Recheck with the server, not just the last in-memory identity. An active startup
  // restore is shared; a pending login/logout must not grant access using an old identity.
  await authSessionService.restoreSession(true);
  return !authSessionService.isAuthOperationInProgress() && authSessionService.authenticatedUser()
    ? true
    : router.createUrlTree(['/login']);
};

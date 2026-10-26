import { computed, inject, Service, signal } from '@angular/core';
import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthApiService } from './auth-api.service';
import { AuthSessionState, LoginRequest } from './auth.models';

@Service()
export class AuthSessionService {
  private readonly authApiService = inject(AuthApiService);
  private readonly sessionStateSignal = signal<AuthSessionState>({ status: 'unknown' });
  private readonly authOperationInProgressSignal = signal(false);
  private hasCheckedSession = false;
  private sessionRestorationPromise?: Promise<void>;
  private sessionRevisionValue = 0;

  get sessionRevision(): number {
    return this.sessionRevisionValue;
  }

  readonly sessionState = this.sessionStateSignal.asReadonly();
  readonly isAuthOperationInProgress = this.authOperationInProgressSignal.asReadonly();
  readonly authenticatedUser = computed(() => {
    const currentSessionState = this.sessionState();
    return currentSessionState.status === 'authenticated' ? currentSessionState.user : undefined;
  });

  expireSessionIfCurrent(expectedSessionRevision: number): boolean {
    // A late 401 from an older request must not erase a newer login or an ongoing
    // authentication operation. That operation confirms its own server outcome.
    if (expectedSessionRevision !== this.sessionRevisionValue || this.isAuthOperationInProgress())
      return false;
    this.sessionRevisionValue++;
    this.sessionStateSignal.set({ status: 'anonymous' });
    this.hasCheckedSession = true;
    return true;
  }

  restoreSession(forceRefresh = false): Promise<void> {
    if (this.sessionRestorationPromise) return this.sessionRestorationPromise;
    // Serialize restoration and mutations: a late /me response must not overwrite a new login.
    if (this.isAuthOperationInProgress() || (this.hasCheckedSession && !forceRefresh))
      return Promise.resolve();
    this.sessionRestorationPromise = this.loadSessionFromApi().finally(() => {
      this.sessionRestorationPromise = undefined;
    });
    return this.sessionRestorationPromise;
  }

  async loginUser(loginRequest: LoginRequest): Promise<void> {
    this.beginAuthOperation();
    const previousSessionState = this.sessionState();
    try {
      const authenticatedUser = await firstValueFrom(this.authApiService.loginUser(loginRequest));
      this.sessionStateSignal.set({ status: 'authenticated', user: authenticatedUser });
      this.hasCheckedSession = true;
    } catch (loginError: unknown) {
      const isCredentialOrValidationFailure =
        loginError instanceof HttpErrorResponse &&
        (loginError.status === HttpStatusCode.BadRequest ||
          loginError.status === HttpStatusCode.Unauthorized);
      this.sessionStateSignal.set(
        isCredentialOrValidationFailure ? previousSessionState : { status: 'error' },
      );
      throw loginError;
    } finally {
      this.endAuthOperation();
    }
  }

  async logoutUser(): Promise<void> {
    this.beginAuthOperation();
    try {
      await firstValueFrom(this.authApiService.logoutUser());
      this.sessionStateSignal.set({ status: 'anonymous' });
      this.hasCheckedSession = true;
    } catch (logoutError: unknown) {
      // The response may have been lost after cookie deletion. Ask /me before claiming an outcome.
      this.sessionStateSignal.set({ status: 'error' });
      throw logoutError;
    } finally {
      this.endAuthOperation();
    }
  }

  private async loadSessionFromApi(): Promise<void> {
    this.beginAuthOperation();
    this.sessionStateSignal.set({ status: 'loading' });
    try {
      const authenticatedUser = await firstValueFrom(this.authApiService.getCurrentUser());
      this.sessionStateSignal.set(
        authenticatedUser
          ? { status: 'authenticated', user: authenticatedUser }
          : { status: 'anonymous' },
      );
    } catch {
      this.sessionStateSignal.set({ status: 'error' });
    } finally {
      this.hasCheckedSession = true;
      this.endAuthOperation();
    }
  }

  private beginAuthOperation(): void {
    if (this.isAuthOperationInProgress())
      throw new Error('An authentication operation is already pending.');
    this.sessionRevisionValue++;
    this.authOperationInProgressSignal.set(true);
  }

  private endAuthOperation(): void {
    // Requests sent during the operation also belong to the previous cookie context.
    this.sessionRevisionValue++;
    this.authOperationInProgressSignal.set(false);
  }
}

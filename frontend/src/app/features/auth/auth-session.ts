import { computed, inject, Service, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthApi } from './auth-api';
import { AuthUser, LoginRequest } from './auth.model';

type SessionState =
  | { readonly status: 'unknown' | 'loading' | 'anonymous' | 'error' }
  | { readonly status: 'authenticated'; readonly user: AuthUser };

@Service()
export class AuthSession {
  private readonly api = inject(AuthApi);
  private readonly stateSignal = signal<SessionState>({ status: 'unknown' });
  private readonly busySignal = signal(false);
  private checked = false;
  private restoring?: Promise<void>;

  readonly state = this.stateSignal.asReadonly();
  readonly busy = this.busySignal.asReadonly();
  readonly user = computed(() => {
    const state = this.state();
    return state.status === 'authenticated' ? state.user : undefined;
  });

  restore(force = false): Promise<void> {
    if (this.restoring) return this.restoring;
    // Serialize restoration and mutations: a late /me response must not overwrite a new login.
    if (this.busy() || (this.checked && !force)) return Promise.resolve();
    this.restoring = this.loadSession().finally(() => {
      this.restoring = undefined;
    });
    return this.restoring;
  }

  async login(request: LoginRequest): Promise<void> {
    this.beginOperation();
    const previous = this.state();
    try {
      const user = await firstValueFrom(this.api.login(request));
      this.stateSignal.set({ status: 'authenticated', user });
      this.checked = true;
    } catch (error: unknown) {
      const rejected =
        error instanceof HttpErrorResponse && (error.status === 400 || error.status === 401);
      this.stateSignal.set(rejected ? previous : { status: 'error' });
      throw error;
    } finally {
      this.busySignal.set(false);
    }
  }

  async logout(): Promise<void> {
    this.beginOperation();
    try {
      await firstValueFrom(this.api.logout());
      this.stateSignal.set({ status: 'anonymous' });
      this.checked = true;
    } catch (error: unknown) {
      // The response may have been lost after cookie deletion. Ask /me before claiming an outcome.
      this.stateSignal.set({ status: 'error' });
      throw error;
    } finally {
      this.busySignal.set(false);
    }
  }

  private async loadSession(): Promise<void> {
    this.beginOperation();
    this.stateSignal.set({ status: 'loading' });
    try {
      const user = await firstValueFrom(this.api.me());
      this.stateSignal.set(user ? { status: 'authenticated', user } : { status: 'anonymous' });
    } catch {
      this.stateSignal.set({ status: 'error' });
    } finally {
      this.checked = true;
      this.busySignal.set(false);
    }
  }

  private beginOperation(): void {
    if (this.busy()) throw new Error('An authentication operation is already pending.');
    this.busySignal.set(true);
  }
}

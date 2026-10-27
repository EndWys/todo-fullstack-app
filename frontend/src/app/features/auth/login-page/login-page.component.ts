import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { email, form, FormField, required, submit, ValidationError } from '@angular/forms/signals';
import { AuthSessionService } from '../auth-session.service';
import { normalizeEmail } from '../email.normalizer';
import { getLoginFailureMessage, parseLoginError } from './login-error.parser';
import type { LoginFailure } from './login.models';
import type { AuthFieldError } from '../auth.models';

@Component({
  imports: [FormField, RouterLink],
  selector: 'app-login',
  styleUrl: './login-page.component.scss',
  templateUrl: './login-page.component.html',
})
export class LoginPageComponent {
  private readonly authSessionService = inject(AuthSessionService);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pageInjector = inject(Injector);

  private readonly pageHeadingElement =
    viewChild<ElementRef<HTMLHeadingElement>>('pageHeadingElement');
  private readonly emailInputElement = viewChild<ElementRef<HTMLInputElement>>('emailInputElement');
  private readonly passwordInputElement =
    viewChild<ElementRef<HTMLInputElement>>('passwordInputElement');

  protected readonly sessionState = this.authSessionService.sessionState;
  protected readonly authenticatedUser = this.authSessionService.authenticatedUser;
  protected readonly isAuthOperationInProgress = this.authSessionService.isAuthOperationInProgress;
  protected readonly hasSessionEnded =
    this.activatedRoute.snapshot.queryParamMap.get('reason') === 'session-ended';

  protected readonly loginFormModel = signal({ email: '', password: '' });

  protected readonly loginForm = form(this.loginFormModel, (loginFormSchemaPath) => {
    required(loginFormSchemaPath.email, { message: 'Email is required.' });
    email(loginFormSchemaPath.email, { message: 'Enter a valid email address.' });
    // Login does not impose the current creation policy on existing credentials.
    required(loginFormSchemaPath.password, { message: 'Password is required.' });
  });

  protected readonly shouldShowEmailErrors = computed(
    () => this.loginForm.email().touched() && this.loginForm.email().invalid(),
  );

  protected readonly shouldShowPasswordErrors = computed(
    () => this.loginForm.password().touched() && this.loginForm.password().invalid(),
  );

  constructor() {
    afterNextRender(() => this.pageHeadingElement()?.nativeElement.focus());
  }

  protected normalizeLoginEmail(): void {
    this.loginFormModel.update((loginFormValue) => ({
      ...loginFormValue,
      email: normalizeEmail(loginFormValue.email),
    }));
  }

  protected async submitLogin(submitEvent: Event): Promise<void> {
    submitEvent.preventDefault();

    if (this.loginForm().submitting()) {
      return;
    }

    if (this.authSessionService.isAuthOperationInProgress()) {
      return;
    }

    this.normalizeLoginEmail();
    const isLoginSuccessful = await submit(this.loginForm, async () => this.executeLogin());

    if (this.destroyRef.destroyed) {
      return;
    }

    if (isLoginSuccessful) {
      this.loginForm().reset({ email: this.loginFormModel().email, password: '' });
    }

    this.focusLoginResultAfterRender(!isLoginSuccessful);
  }

  protected async signOut(): Promise<void> {
    if (this.authSessionService.isAuthOperationInProgress()) {
      return;
    }

    try {
      await this.authSessionService.logoutUser();
    } catch {
      /* Session state offers an explicit /me recovery. */
    }
    if (this.destroyRef.destroyed) {
      return;
    }

    this.loginForm().reset({ email: this.loginFormModel().email, password: '' });
    this.focusLoginResultAfterRender(false);
  }

  protected async checkCurrentSession(): Promise<void> {
    await this.authSessionService.restoreSession(true);
    if (this.destroyRef.destroyed) {
      return;
    }

    const authenticatedUser = this.authSessionService.authenticatedUser();
    if (authenticatedUser) {
      this.loginForm().reset({ email: authenticatedUser.email, password: '' });
    }

    this.focusLoginResultAfterRender(false);
  }

  protected getFieldDescriptionId(field: AuthFieldError['field']): string | null {
    if (field === 'email' && this.shouldShowEmailErrors()) {
      return 'login-email-errors';
    }

    if (field === 'password' && this.shouldShowPasswordErrors()) {
      return 'login-password-errors';
    }

    return null;
  }

  private async executeLogin(): Promise<ValidationError.WithOptionalFieldTree[] | undefined> {
    try {
      // The session service owns this bounded request even if the form is navigated away from.
      await this.authSessionService.loginUser({ ...this.loginFormModel() });
      return undefined;
    } catch (loginError: unknown) {
      if (this.destroyRef.destroyed) {
        return undefined;
      }

      return this.mapLoginFailureToFormErrors(parseLoginError(loginError));
    }
  }

  private mapLoginFailureToFormErrors(
    loginFailure: LoginFailure,
  ): ValidationError.WithOptionalFieldTree[] {
    if (loginFailure.kind === 'validation') {
      return loginFailure.errors.map(({ field, message }) => ({
        fieldTree: this.loginForm[field],
        kind: 'server',
        message,
      }));
    }

    return [{ kind: 'request', message: getLoginFailureMessage(loginFailure) }];
  }

  private focusLoginResultAfterRender(shouldFocusInvalidField: boolean): void {
    afterNextRender(() => this.focusLoginResult(shouldFocusInvalidField), {
      injector: this.pageInjector,
    });
  }

  private focusLoginResult(shouldFocusInvalidField: boolean): void {
    if (!shouldFocusInvalidField) {
      this.pageHeadingElement()?.nativeElement.focus();
      return;
    }

    if (this.loginForm.email().invalid()) {
      this.emailInputElement()?.nativeElement.focus();
      return;
    }

    if (this.loginForm.password().invalid()) {
      this.passwordInputElement()?.nativeElement.focus();
      return;
    }

    this.pageHeadingElement()?.nativeElement.focus();
  }
}

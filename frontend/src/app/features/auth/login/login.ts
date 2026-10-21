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
import { RouterLink } from '@angular/router';
import { email, form, FormField, required, submit, ValidationError } from '@angular/forms/signals';
import { AuthSession } from '../auth-session';
import { normalizeEmail } from '../email-normalization';
import { loginFailureMessage, LoginFailure, parseLoginError } from './login-error';

@Component({
  imports: [FormField, RouterLink],
  selector: 'app-login',
  styleUrl: './login.scss',
  templateUrl: './login.html',
})
export class Login {
  protected readonly session = inject(AuthSession);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly heading = viewChild<ElementRef<HTMLHeadingElement>>('heading');
  private readonly emailInput = viewChild<ElementRef<HTMLInputElement>>('emailInput');
  private readonly passwordInput = viewChild<ElementRef<HTMLInputElement>>('passwordInput');
  protected readonly model = signal({ email: '', password: '' });
  protected readonly loginForm = form(this.model, (path) => {
    required(path.email, { message: 'Email is required.' });
    email(path.email, { message: 'Enter a valid email address.' });
    // Login does not impose the current creation policy on existing credentials.
    required(path.password, { message: 'Password is required.' });
  });
  protected readonly showEmailError = computed(
    () => this.loginForm.email().touched() && this.loginForm.email().invalid(),
  );
  protected readonly showPasswordError = computed(
    () => this.loginForm.password().touched() && this.loginForm.password().invalid(),
  );

  protected normalizeEmail(): void {
    this.model.update((value) => ({ ...value, email: normalizeEmail(value.email) }));
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.loginForm().submitting() || this.session.busy()) return;
    this.normalizeEmail();
    const successful = await submit(this.loginForm, async () => {
      try {
        // The session service owns this bounded request even if the form is navigated away from.
        await this.session.login({ ...this.model() });
        return undefined;
      } catch (error: unknown) {
        if (this.destroyRef.destroyed) return undefined;
        return this.toFormErrors(parseLoginError(error));
      }
    });
    if (this.destroyRef.destroyed) return;
    if (successful) this.loginForm().reset({ email: this.model().email, password: '' });
    this.focusAfterRender(!successful);
  }

  protected async logout(): Promise<void> {
    if (this.session.busy()) return;
    try {
      await this.session.logout();
    } catch {
      /* Session state offers an explicit /me recovery. */
    }
    if (this.destroyRef.destroyed) return;
    this.loginForm().reset({ email: this.model().email, password: '' });
    this.focusAfterRender(false);
  }

  protected async checkSession(): Promise<void> {
    await this.session.restore(true);
    if (this.destroyRef.destroyed) return;
    const user = this.session.user();
    if (user) this.loginForm().reset({ email: user.email, password: '' });
    this.focusAfterRender(false);
  }

  private toFormErrors(failure: LoginFailure): ValidationError.WithOptionalFieldTree[] {
    if (failure.kind === 'validation')
      return failure.errors.map(({ field, message }) => ({
        fieldTree: this.loginForm[field],
        kind: 'server',
        message,
      }));
    return [{ kind: 'request', message: loginFailureMessage(failure) }];
  }

  private focusAfterRender(invalid: boolean): void {
    afterNextRender(
      () => {
        const target =
          invalid && this.loginForm.email().invalid()
            ? this.emailInput()
            : invalid && this.loginForm.password().invalid()
              ? this.passwordInput()
              : this.heading();
        target?.nativeElement.focus();
      },
      { injector: this.injector },
    );
  }
}

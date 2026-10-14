import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  email,
  form,
  FormField,
  required,
  submit,
  validate,
  ValidationError,
} from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { AuthApi } from '../auth-api';

@Component({
  imports: [FormField],
  selector: 'app-register',
  styleUrl: './register.scss',
  templateUrl: './register.html',
})
export class Register {
  private readonly authApi = inject(AuthApi);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly model = signal({
    email: '',
    password: '',
  });

  protected readonly registeredEmail = signal('');
  protected readonly passwordLength = computed(() => [...this.model().password].length);

  protected readonly showEmailError = computed(() => {
    const field = this.registrationForm.email();

    return field.touched() && field.invalid();
  });

  protected readonly showPasswordError = computed(() => {
    const field = this.registrationForm.password();

    return field.touched() && field.invalid();
  });

  protected readonly registrationForm = form(this.model, (path) => {
    required(path.email, { message: 'Email is required.' });
    email(path.email, { message: 'Enter a valid email address.' });
    required(path.password, { message: 'Password is required.' });

    validate(path.password, ({ value }) => {
      const password = value();
      if (password.length === 0) {
        return undefined;
      }

      // Unicode White_Space matches the whitespace rule used by the backend.
      if (/^\p{White_Space}+$/u.test(password)) {
        return { kind: 'whitespace', message: 'Password cannot contain only whitespace.' };
      }

      const length = [...password].length;
      if (length < 15) {
        return { kind: 'tooShort', message: 'Use at least 15 characters.' };
      }

      if (length > 256) {
        return { kind: 'tooLong', message: 'Use no more than 256 characters.' };
      }

      return undefined;
    });
  });

  protected normalizeEmail(): void {
    // .NET String.Trim uses Unicode White_Space, unlike JavaScript trim().
    this.model.update((value) => ({
      ...value,
      email: value.email.replace(/^\p{White_Space}+|\p{White_Space}+$/gu, ''),
    }));
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.registrationForm().submitting()) {
      return;
    }
    this.registeredEmail.set('');
    this.normalizeEmail();

    const successful = await submit(this.registrationForm, async () => {
      try {
        const response = await firstValueFrom(
          this.authApi.register({ ...this.model() }).pipe(takeUntilDestroyed(this.destroyRef)),
        );
        this.registeredEmail.set(response.email);
        return undefined;
      } catch (error: unknown) {
        const fieldErrors = this.getServerFieldErrors(error);
        if (fieldErrors.length > 0) {
          return fieldErrors;
        }
        return {
          kind: 'request',
          message:
            error instanceof HttpErrorResponse && error.status === 0
              ? 'The server could not be reached or the request timed out. Registration could not be confirmed.'
              : 'Registration could not be confirmed. Please try again.',
        };
      }
    });

    if (successful) {
      this.registrationForm().reset({ email: this.registeredEmail(), password: '' });
    }
  }

  private getServerFieldErrors(error: unknown): ValidationError.WithFieldTree[] {
    if (!(error instanceof HttpErrorResponse) || (error.status !== 400 && error.status !== 409)) {
      return [];
    }
    const body: unknown = error.error;
    if (typeof body !== 'object' || body === null || !('errors' in body)) {
      return [];
    }
    const errors = body.errors;
    if (typeof errors !== 'object' || errors === null) {
      return [];
    }
    const fields = errors as Record<string, unknown>;
    return (['email', 'password'] as const).flatMap((field) => {
      const messages = fields[field];
      if (!Array.isArray(messages) || !messages.every((message) => typeof message === 'string')) {
        return [];
      }
      const message = messages.join(' ').trim();
      return message
        ? [
            {
              fieldTree: this.registrationForm[field],
              kind: 'server',
              message,
            },
          ]
        : [];
    });
  }
}

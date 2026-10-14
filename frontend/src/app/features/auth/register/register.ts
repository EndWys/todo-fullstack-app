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
import { normalizeEmail } from '../email-normalization';
import { validatePassword } from './register-validation';
import { parseRegistrationError, RegistrationFailure } from './registration-error';

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

    validate(path.password, ({ value }) => validatePassword(value()));
  });

  protected normalizeEmail(): void {
    this.model.update((value) => ({
      ...value,
      email: normalizeEmail(value.email),
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
        return this.toFormErrors(parseRegistrationError(error));
      }
    });

    if (successful) {
      this.registrationForm().reset({ email: this.registeredEmail(), password: '' });
    }
  }

  private toFormErrors(failure: RegistrationFailure): ValidationError.WithOptionalFieldTree[] {
    if (failure.kind === 'validation') {
      return failure.errors.map(({ field, message }) => ({
        fieldTree: this.registrationForm[field],
        kind: 'server',
        message,
      }));
    }
    return [
      {
        kind: 'request',
        message:
          failure.kind === 'network'
            ? 'The server could not be reached or the request timed out. Registration could not be confirmed.'
            : 'Registration could not be confirmed. Please try again.',
      },
    ];
  }
}

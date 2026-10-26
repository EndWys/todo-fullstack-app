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
import { AuthApiService } from '../auth-api.service';
import { normalizeEmail } from '../email.normalizer';
import {
  REGISTRATION_PASSWORD_MAX_CODE_POINTS,
  REGISTRATION_PASSWORD_MIN_CODE_POINTS,
} from './registration-password.constants';
import { validateRegistrationPassword } from './registration-password.validator';
import { parseRegistrationError } from './registration-error.parser';
import type { RegistrationFailure } from './registration.models';

@Component({
  imports: [FormField],
  selector: 'app-register',
  styleUrl: './registration-page.component.scss',
  templateUrl: './registration-page.component.html',
})
export class RegistrationPageComponent {
  private readonly authApiService = inject(AuthApiService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly registrationPasswordMinCodePoints = REGISTRATION_PASSWORD_MIN_CODE_POINTS;
  protected readonly registrationPasswordMaxCodePoints = REGISTRATION_PASSWORD_MAX_CODE_POINTS;
  protected readonly registrationFormModel = signal({
    email: '',
    password: '',
  });

  private readonly registeredEmailSignal = signal('');
  protected readonly registeredEmail = this.registeredEmailSignal.asReadonly();
  protected readonly passwordCodePointCount = computed(
    () => [...this.registrationFormModel().password].length,
  );

  protected readonly shouldShowEmailErrors = computed(() => {
    const emailFieldState = this.registrationForm.email();

    return emailFieldState.touched() && emailFieldState.invalid();
  });

  protected readonly shouldShowPasswordErrors = computed(() => {
    const passwordFieldState = this.registrationForm.password();

    return passwordFieldState.touched() && passwordFieldState.invalid();
  });

  protected readonly registrationForm = form(
    this.registrationFormModel,
    (registrationFormSchemaPath) => {
      required(registrationFormSchemaPath.email, { message: 'Email is required.' });
      email(registrationFormSchemaPath.email, { message: 'Enter a valid email address.' });
      required(registrationFormSchemaPath.password, { message: 'Password is required.' });

      validate(registrationFormSchemaPath.password, ({ value: passwordValue }) =>
        validateRegistrationPassword(passwordValue()),
      );
    },
  );

  protected clearRegistrationSuccess(): void {
    this.registeredEmailSignal.set('');
  }

  protected normalizeRegistrationEmail(): void {
    this.registrationFormModel.update((registrationFormValue) => ({
      ...registrationFormValue,
      email: normalizeEmail(registrationFormValue.email),
    }));
  }

  protected async submitRegistration(submitEvent: Event): Promise<void> {
    submitEvent.preventDefault();
    if (this.registrationForm().submitting()) {
      return;
    }
    this.clearRegistrationSuccess();
    this.normalizeRegistrationEmail();

    const isRegistrationSuccessful = await submit(this.registrationForm, async () => {
      try {
        const registrationResponse = await firstValueFrom(
          this.authApiService
            .registerUser({ ...this.registrationFormModel() })
            .pipe(takeUntilDestroyed(this.destroyRef)),
        );
        this.registeredEmailSignal.set(registrationResponse.email);
        return undefined;
      } catch (registrationError: unknown) {
        return this.mapRegistrationFailureToFormErrors(parseRegistrationError(registrationError));
      }
    });

    if (isRegistrationSuccessful) {
      this.registrationForm().reset({ email: this.registeredEmail(), password: '' });
    }
  }

  private mapRegistrationFailureToFormErrors(
    registrationFailure: RegistrationFailure,
  ): ValidationError.WithOptionalFieldTree[] {
    if (registrationFailure.kind === 'validation') {
      return registrationFailure.errors.map(({ field, message }) => ({
        fieldTree: this.registrationForm[field],
        kind: 'server',
        message,
      }));
    }
    return [
      {
        kind: 'request',
        message:
          registrationFailure.kind === 'network'
            ? 'The server could not be reached or the request timed out. Registration could not be confirmed.'
            : 'Registration could not be confirmed. Please try again.',
      },
    ];
  }
}

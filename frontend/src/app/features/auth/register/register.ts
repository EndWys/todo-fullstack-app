import { Component, computed, signal } from '@angular/core';
import { email, form, FormField, required, submit, validate } from '@angular/forms/signals';

@Component({
  imports: [FormField],
  selector: 'app-register',
  styleUrl: './register.scss',
  templateUrl: './register.html',
})
export class Register {
  protected readonly model = signal({
    email: '',
    password: '',
  });

  protected readonly locallyValidated = signal(false);
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
    this.model.update((value) => ({ ...value, email: value.email.trim() }));
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.locallyValidated.set(false);
    this.normalizeEmail();

    await submit(this.registrationForm, async () => {
      this.locallyValidated.set(true);
    });
  }
}

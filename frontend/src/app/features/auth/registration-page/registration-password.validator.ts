import {
  REGISTRATION_PASSWORD_MAX_CODE_POINTS,
  REGISTRATION_PASSWORD_MIN_CODE_POINTS,
} from './registration-password.constants';

export interface RegistrationPasswordValidationError {
  readonly kind: 'whitespace' | 'tooShort' | 'tooLong';
  readonly message: string;
}

// Required-field validation is applied separately by the form schema.
export function validateRegistrationPassword(
  password: string,
): RegistrationPasswordValidationError | undefined {
  if (password.length === 0) {
    return undefined;
  }

  if (/^\p{White_Space}+$/u.test(password)) {
    return { kind: 'whitespace', message: 'Password cannot contain only whitespace.' };
  }

  const passwordCodePointCount = [...password].length;

  if (passwordCodePointCount < REGISTRATION_PASSWORD_MIN_CODE_POINTS) {
    return {
      kind: 'tooShort',
      message: `Use at least ${REGISTRATION_PASSWORD_MIN_CODE_POINTS} characters.`,
    };
  }

  if (passwordCodePointCount > REGISTRATION_PASSWORD_MAX_CODE_POINTS) {
    return {
      kind: 'tooLong',
      message: `Use no more than ${REGISTRATION_PASSWORD_MAX_CODE_POINTS} characters.`,
    };
  }

  return undefined;
}

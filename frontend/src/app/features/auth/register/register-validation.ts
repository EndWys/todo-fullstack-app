export interface PasswordPolicyError {
  kind: 'whitespace' | 'tooShort' | 'tooLong';
  message: string;
}

// Required-field validation is applied separately by the form schema.
export function validatePassword(password: string): PasswordPolicyError | undefined {
  if (password.length === 0) {
    return undefined;
  }

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
}

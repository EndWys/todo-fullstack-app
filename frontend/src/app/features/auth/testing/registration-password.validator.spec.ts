import { validateRegistrationPassword } from '../registration-page/registration-password.validator';

describe('validateRegistrationPassword', () => {
  it('leaves empty-value validation to the required rule', () => {
    expect(validateRegistrationPassword('')).toBeUndefined();
  });

  it.each([
    ['a'.repeat(14), 'tooShort'],
    ['a'.repeat(257), 'tooLong'],
    ['😀'.repeat(14), 'tooShort'],
    ['😀'.repeat(257), 'tooLong'],
    [' '.repeat(15), 'whitespace'],
    ['\u0085\u00a0\u2003'.repeat(5), 'whitespace'],
    [' ', 'whitespace'],
    [' '.repeat(257), 'whitespace'],
  ])('returns the expected policy error for %j', (value, kind) => {
    expect(validateRegistrationPassword(value)?.kind).toBe(kind);
    expect(validateRegistrationPassword(value)?.message).toBeTruthy();
  });

  it.each([
    'a'.repeat(15),
    'a'.repeat(256),
    '😀'.repeat(15),
    '😀'.repeat(256),
    '  correct horse  ',
    '\ufeff'.repeat(15),
  ])('accepts a valid password: %j', (value) => {
    expect(validateRegistrationPassword(value)).toBeUndefined();
  });
});

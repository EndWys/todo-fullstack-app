import { HttpErrorResponse } from '@angular/common/http';
import { getLoginFailureMessage, parseLoginError } from '../login-page/login-error.parser';

describe('login errors', () => {
  it('uses one fixed credentials error without exposing server detail', () => {
    const failure = parseLoginError(
      new HttpErrorResponse({ status: 401, error: { detail: 'private database detail' } }),
    );
    expect(failure).toEqual({ kind: 'credentials' });
    expect(getLoginFailureMessage({ kind: 'credentials' })).toBe('Invalid email or password.');
  });
  it('maps only known valid field errors from 400', () => {
    expect(
      parseLoginError(
        new HttpErrorResponse({
          status: 400,
          error: {
            errors: {
              email: ['Invalid email.'],
              password: 42,
              privateField: ['hidden'],
            },
          },
        }),
      ),
    ).toEqual({ kind: 'validation', errors: [{ field: 'email', message: 'Invalid email.' }] });
  });
  it('recognizes CSRF separately from field validation', () => {
    expect(
      parseLoginError(
        new HttpErrorResponse({ status: 400, error: { code: 'csrf_validation_failed' } }),
      ),
    ).toEqual({ kind: 'csrf' });
  });
  it.each([null, {}, { errors: null }, { errors: { email: ['bad', 42] } }])(
    'handles malformed payload %j',
    (responseBody) => {
      expect(parseLoginError(new HttpErrorResponse({ status: 400, error: responseBody }))).toEqual({
        kind: 'unexpected',
      });
    },
  );
  it('distinguishes network and unexpected errors', () => {
    expect(parseLoginError(new HttpErrorResponse({ status: 0 }))).toEqual({ kind: 'network' });
    expect(parseLoginError(new HttpErrorResponse({ status: 500, error: 'secret' }))).toEqual({
      kind: 'unexpected',
    });
    expect(parseLoginError(new Error('secret'))).toEqual({ kind: 'unexpected' });
  });
});

import { HttpErrorResponse } from '@angular/common/http';
import { parseRegistrationError } from '../registration-page/registration-error.parser';

describe('parseRegistrationError', () => {
  it.each([400, 409])('parses known fields from status %i without form dependencies', (status) => {
    const error = new HttpErrorResponse({
      status,
      error: {
        errors: {
          email: ['First email error.', 'Second email error.'],
          password: ['Password error.'],
          internalField: ['Ignore this field.'],
        },
      },
    });

    expect(parseRegistrationError(error)).toEqual({
      kind: 'validation',
      errors: [
        { field: 'email', message: 'First email error. Second email error.' },
        { field: 'password', message: 'Password error.' },
      ],
    });
  });

  it('classifies network failures without exposing raw error details', () => {
    expect(
      parseRegistrationError(new HttpErrorResponse({ status: 0, error: 'private details' })),
    ).toEqual({ kind: 'network' });
  });

  it.each([
    null,
    'not JSON',
    {},
    { errors: null },
    { errors: 'invalid' },
    { errors: { email: 42 } },
    { errors: { email: ['message', 42] } },
    { errors: { email: [] } },
    { errors: { email: ['   '] } },
    { errors: { other: ['unknown field'] } },
  ])('safely handles malformed or unusable validation payload: %j', (responseBody) => {
    expect(
      parseRegistrationError(new HttpErrorResponse({ status: 400, error: responseBody })),
    ).toEqual({
      kind: 'unexpected',
    });
  });

  it.each([401, 403, 404, 500, 503])('does not expose field errors for status %i', (status) => {
    const error = new HttpErrorResponse({
      status,
      error: { errors: { email: ['Internal server details.'] } },
    });
    expect(parseRegistrationError(error)).toEqual({ kind: 'unexpected' });
  });

  it.each([new Error('private details'), undefined, null, 'failed'])(
    'handles non-HTTP errors',
    (error) => {
      expect(parseRegistrationError(error)).toEqual({ kind: 'unexpected' });
    },
  );

  it('keeps valid known fields when another field has malformed errors', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { errors: { email: ['Valid error.'], password: 42 } },
    });
    expect(parseRegistrationError(error)).toEqual({
      kind: 'validation',
      errors: [{ field: 'email', message: 'Valid error.' }],
    });
  });
});

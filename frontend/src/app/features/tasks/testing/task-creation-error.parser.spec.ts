import { HttpErrorResponse } from '@angular/common/http';
import { parseTaskCreationError } from '../task-create-form/task-creation-error.parser';

describe('parseTaskCreationError', () => {
  it('keeps only known well-formed field messages', () => {
    expect(
      parseTaskCreationError(
        new HttpErrorResponse({
          status: 400,
          error: {
            errors: {
              title: ['Too long.', 'Change it.'],
              description: 4,
              priority: ['Invalid priority.'],
              privateField: ['secret'],
            },
          },
        }),
      ),
    ).toEqual({
      kind: 'validation',
      errors: [
        { field: 'title', message: 'Too long. Change it.' },
        { field: 'priority', message: 'Invalid priority.' },
      ],
    });
  });
  it('distinguishes CSRF and expired session', () => {
    expect(
      parseTaskCreationError(
        new HttpErrorResponse({ status: 400, error: { code: 'csrf_validation_failed' } }),
      ),
    ).toEqual({ kind: 'csrf' });
    expect(parseTaskCreationError(new HttpErrorResponse({ status: 401 }))).toEqual({
      kind: 'session',
    });
  });
  it.each([
    null,
    {},
    { errors: null },
    { errors: { title: ['bad', 42] } },
    { errors: { title: [' '] } },
  ])('rejects malformed validation %j', (body) => {
    expect(parseTaskCreationError(new HttpErrorResponse({ status: 400, error: body }))).toEqual({
      kind: 'unconfirmed',
    });
  });
  it.each([0, 403, 415, 500])('does not expose technical error %i', (status) => {
    expect(
      parseTaskCreationError(new HttpErrorResponse({ status, error: { detail: 'private' } })),
    ).toEqual({ kind: 'unconfirmed' });
  });
  it('treats unexpected client failures as unconfirmed', () => {
    expect(parseTaskCreationError(new Error('private'))).toEqual({ kind: 'unconfirmed' });
  });
});

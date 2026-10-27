import {
  validateTaskDescription,
  validateTaskTitle,
} from '../task-create-form/task-creation.validator';

describe('Task creation text rules', () => {
  it.each(['', '  ', '\u0085\u2000\r\n'])('rejects empty normalized title %j', (title) => {
    expect(validateTaskTitle(title)?.kind).toBe('required');
  });
  it.each([
    'x',
    '😀'.repeat(200),
    `\u0085${'a'.repeat(200)}\u0085`,
    '\uFEFF',
    '<script>alert(1)</script>',
  ])('accepts title %j', (title) => {
    expect(validateTaskTitle(title)).toBeUndefined();
  });
  it.each(['a'.repeat(201), '😀'.repeat(201)])('limits title by code points', (title) => {
    expect(validateTaskTitle(title)?.kind).toBe('tooLong');
  });
  it.each(['a\nb', 'a\rb', 'a\tb', 'a\u0085b', 'a\u2028b', 'a\u2029b', 'a\0b'])(
    'rejects title controls %j',
    (title) => {
      expect(validateTaskTitle(title)?.kind).toBe('characters');
    },
  );
  it.each(['a\ud800b', '\udc00', 'a\ud800'])('rejects invalid UTF-16 %j', (text) => {
    expect(validateTaskTitle(text)?.kind).toBe('unicode');
    expect(validateTaskDescription(text)?.kind).toBe('unicode');
  });
  it.each(['', '  ', 'line one\nline two\tend\r\n', '😀'.repeat(2000), 'line\u2028next'])(
    'accepts description %j',
    (description) => {
      expect(validateTaskDescription(description)).toBeUndefined();
    },
  );
  it('limits description and rejects non-text controls', () => {
    expect(validateTaskDescription('😀'.repeat(2001))?.kind).toBe('tooLong');
    expect(validateTaskDescription('a\0b')?.kind).toBe('characters');
    expect(validateTaskDescription('a\u0085b')?.kind).toBe('characters');
  });
});

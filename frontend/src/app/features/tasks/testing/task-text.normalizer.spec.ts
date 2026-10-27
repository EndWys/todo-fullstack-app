import { normalizeTaskText } from '../task-create-form/task-text.normalizer';

describe('normalizeTaskText', () => {
  it('matches .NET whitespace rather than JavaScript trim', () => {
    expect(normalizeTaskText('\u0085 A \u0085')).toBe('A');
    expect(normalizeTaskText('\uFEFFA\uFEFF')).toBe('\uFEFFA\uFEFF');
  });
});

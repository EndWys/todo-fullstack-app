import { normalizeEmail } from '../email.normalizer';

describe('normalizeEmail', () => {
  it.each([
    ['', ''],
    ['Denis@Example.com', 'Denis@Example.com'],
    ['  Denis@Example.com  ', 'Denis@Example.com'],
    ['\u0085Denis@Example.com\u0085', 'Denis@Example.com'],
    ['\t\n\u00a0Denis@Example.com\u2003\r', 'Denis@Example.com'],
    ['\u0085 \u00a0', ''],
  ])('normalizes %j to %j', (input, expected) => {
    expect(normalizeEmail(input)).toBe(expected);
  });

  it('does not remove whitespace inside the address', () => {
    expect(normalizeEmail(' de nis@example.com ')).toBe('de nis@example.com');
  });

  it('preserves U+FEFF, which .NET does not treat as whitespace', () => {
    expect(normalizeEmail('\ufeffdenis@example.com\ufeff')).toBe('\ufeffdenis@example.com\ufeff');
  });

  it('is idempotent', () => {
    const value = normalizeEmail('\u0085Denis@Example.com ');
    expect(normalizeEmail(value)).toBe(value);
  });
});

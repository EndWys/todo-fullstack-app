export function normalizeTaskText(value: string): string {
  // Match .NET Trim(), including U+0085 and excluding U+FEFF.
  return value.replace(/^\p{White_Space}+|\p{White_Space}+$/gu, '');
}

export function normalizeEmail(email: string): string {
  // Match .NET String.Trim: JavaScript trim() uses a different whitespace set.
  return email.replace(/^\p{White_Space}+|\p{White_Space}+$/gu, '');
}

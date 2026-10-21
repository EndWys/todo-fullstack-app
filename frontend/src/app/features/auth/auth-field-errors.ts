export interface AuthFieldError {
  field: 'email' | 'password';
  message: string;
}

export function readAuthFieldErrors(body: unknown): AuthFieldError[] {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('errors' in body) ||
    typeof body.errors !== 'object' ||
    body.errors === null
  )
    return [];
  const fields = body.errors as Record<string, unknown>;
  return (['email', 'password'] as const).flatMap((field) => {
    const messages = fields[field];
    if (!Array.isArray(messages) || !messages.every((message) => typeof message === 'string'))
      return [];
    const message = messages.join(' ').trim();
    return message ? [{ field, message }] : [];
  });
}

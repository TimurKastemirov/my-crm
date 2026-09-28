/** Extracts a human-readable message from the API response (AllExceptionsFilter format). */
export function extractErrorMessage(error: unknown, fallback: string): string {
  const body = (error as { error?: { message?: string | string[] } })?.error;
  const message = body?.message;
  if (Array.isArray(message)) return message.join(', ');
  return typeof message === 'string' && message ? message : fallback;
}

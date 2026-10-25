/*
 * Dates are stored and exchanged in UTC (ISO strings); the UI shows them in the browser's time zone.
 * <input type="datetime-local"> works in local wall-clock time without an offset, so values must be
 * converted both ways — slicing an ISO string would show (and then save) UTC as if it were local.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO timestamp (UTC) → "YYYY-MM-DDTHH:mm" in the browser's time zone, for a datetime-local input. */
export function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local value (browser's time zone) → ISO timestamp in UTC. */
export function localInputToIso(value: string): string {
  // A date-time string without an offset is parsed as local time.
  return new Date(value).toISOString();
}

/** The browser's IANA time zone (e.g. "Europe/Kyiv"), or null if the runtime can't tell. */
export function browserTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

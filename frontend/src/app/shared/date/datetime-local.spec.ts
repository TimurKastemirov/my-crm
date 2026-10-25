import { isoToLocalInput, localInputToIso } from './datetime-local';

// `npm test` pins TZ=Europe/Berlin (CET +1 / CEST +2), so these fail if a conversion
// treats local time as UTC — which a UTC machine alone would never reveal.
describe('datetime-local conversion (TZ=Europe/Berlin)', () => {
  it('runs in a non-UTC zone', () => {
    expect(new Date('2026-03-01T00:00:00Z').getTimezoneOffset()).toBe(-60);
  });

  it('shows a UTC timestamp in the browser time zone', () => {
    expect(isoToLocalInput('2026-03-01T06:15:00.000Z')).toBe('2026-03-01T07:15');
    expect(isoToLocalInput('2026-07-01T06:15:00.000Z')).toBe('2026-07-01T08:15');
  });

  it('reads the input as local wall-clock time and returns UTC', () => {
    expect(localInputToIso('2026-03-01T07:15')).toBe('2026-03-01T06:15:00.000Z');
    expect(localInputToIso('2026-07-01T08:15')).toBe('2026-07-01T06:15:00.000Z');
  });

  it('round-trips without shifting the time (open the form and save → same instant)', () => {
    const iso = '2026-10-20T21:30:00.000Z';
    expect(localInputToIso(isoToLocalInput(iso))).toBe(iso);
  });
});

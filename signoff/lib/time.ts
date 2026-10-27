/** Offset in minutes of `timeZone` from UTC at the given instant. */
function offsetMinutes(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return (asUtc - instant.getTime()) / 60000;
}

/** "2026-11-04T09:30" in the workspace's timezone -> ISO string in UTC */
export function localInputToUtc(value: string, timeZone: string): string | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const first = guess - offsetMinutes(new Date(guess), timeZone) * 60000;
  // second pass handles daylight saving boundaries
  const exact = guess - offsetMinutes(new Date(first), timeZone) * 60000;
  return new Date(exact).toISOString();
}

/** UTC ISO -> "2026-11-04T09:30" in the workspace's timezone, for <input type="datetime-local"> */
export function utcToLocalInput(iso: string | null, timeZone: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(d).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** "YYYY-MM-DD" of an instant in the given timezone */
export function dayKey(iso: string, timeZone: string) {
  return utcToLocalInput(iso, timeZone).slice(0, 10);
}

export function formatPlanned(iso: string | null, timeZone: string) {
  if (!iso) return 'No date yet';
  return new Intl.DateTimeFormat('en-AU', {
    timeZone, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  }).format(new Date(iso));
}

export function formatShort(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-AU', { timeZone, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
    .format(new Date(iso));
}

export function formatSeconds(s: number) {
  const whole = Math.floor(s);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export const TIMEZONES = [
  'Australia/Perth', 'Australia/Darwin', 'Australia/Adelaide', 'Australia/Brisbane', 'Australia/Sydney',
  'Australia/Melbourne', 'Australia/Hobart', 'Pacific/Auckland', 'Asia/Makassar', 'Asia/Singapore',
  'Europe/London', 'America/New_York', 'America/Los_Angeles', 'UTC',
];

/**
 * Date helpers. The app deliberately works with plain `YYYY-MM-DD` day keys:
 * sales are aggregated per calendar day and dates never need timezone
 * conversion beyond the server's local day.
 */

/** `YYYY-MM-DD` for a Date, using its local calendar day. */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Date at local midnight for an ISO day key. */
export function fromISODate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Day key `n` days before `date` (n=0 returns `date` itself). */
export function isoDaysBefore(date: Date, n: number): string {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() - n);
  return toISODate(shifted);
}

/** Chronological (oldest-first) sort key for ISO day strings is lexical order. */
export function byISODateAsc(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

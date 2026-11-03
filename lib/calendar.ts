// Calendar maths on ISO calendar dates ("YYYY-MM-DD"), always in UTC so a
// date never shifts with the viewer's time zone. ISO strings compare correctly
// with < and >.

const DAY = 86_400_000;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export type Ymd = { year: number; month: number; day: number }; // month 0-11

export function parseIso(iso: string): Ymd | null {
  const m = ISO.exec(iso);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const t = Date.UTC(year, month, day);
  const back = new Date(t);
  if (back.getUTCFullYear() !== year || back.getUTCMonth() !== month || back.getUTCDate() !== day) return null;
  return { year, month, day };
}

export function toIso(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

function ms(iso: string): number {
  const p = parseIso(iso);
  if (!p) throw new Error(`Invalid date: ${iso}`);
  return Date.UTC(p.year, p.month, p.day);
}

export function addDays(iso: string, days: number): string {
  return new Date(ms(iso) + days * DAY).toISOString().slice(0, 10);
}

/** Adds months, clamping the day so 31 Jan + 1 month = 28/29 Feb. */
export function addMonths(iso: string, months: number): string {
  const p = parseIso(iso)!;
  const target = new Date(Date.UTC(p.year, p.month + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return toIso(target.getUTCFullYear(), target.getUTCMonth(), Math.min(p.day, lastDay));
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(iso: string): number {
  return new Date(ms(iso)).getUTCDay();
}

export function startOfWeek(iso: string, weekStartsOn = 1): string {
  return addDays(iso, -((weekday(iso) - weekStartsOn + 7) % 7));
}

export function endOfWeek(iso: string, weekStartsOn = 1): string {
  return addDays(startOfWeek(iso, weekStartsOn), 6);
}

/** 6 weeks × 7 days covering the month, starting on `weekStartsOn`. */
export function monthGrid(year: number, month: number, weekStartsOn = 1): string[][] {
  let cursor = startOfWeek(toIso(year, month, 1), weekStartsOn);
  return Array.from({ length: 6 }, () =>
    Array.from({ length: 7 }, () => {
      const d = cursor;
      cursor = addDays(cursor, 1);
      return d;
    }),
  );
}

export function clampIso(iso: string, min?: string, max?: string): string {
  if (min && iso < min) return min;
  if (max && iso > max) return max;
  return iso;
}

export function isOutside(iso: string, min?: string, max?: string): boolean {
  return Boolean((min && iso < min) || (max && iso > max));
}

const fmt = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...options });
const monthFmt = fmt({ month: "long", year: "numeric" });
const longFmt = fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortFmt = fmt({ weekday: "short", day: "numeric", month: "short", year: "numeric" });
const compactFmt = fmt({ day: "numeric", month: "short", year: "numeric" });

export const formatMonth = (year: number, month: number) => monthFmt.format(Date.UTC(year, month, 1));
export const formatLong = (iso: string) => longFmt.format(ms(iso));
export const formatShort = (iso: string) => shortFmt.format(ms(iso));
/** "4 Nov 2026": fits narrow date fields. */
export const formatCompact = (iso: string) => compactFmt.format(ms(iso));

/** Weekday headers starting on `weekStartsOn`, e.g. { short: "Mo", long: "Monday" }. */
export function weekdayLabels(weekStartsOn = 1): { short: string; long: string }[] {
  const long = fmt({ weekday: "long" });
  // 2024-01-07 was a Sunday.
  return Array.from({ length: 7 }, (_, i) => {
    const name = long.format(Date.UTC(2024, 0, 7 + ((weekStartsOn + i) % 7)));
    return { short: name.slice(0, 2), long: name };
  });
}

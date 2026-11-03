import { badRequest } from "./auth";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_LOAN_DAYS = 30;

export function todayUtc(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );
}

function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && todayUtc(parsed.getTime()) === value;
}

export function validateLoanDates(
  startDate: string,
  endDate: string,
  now: number = Date.now(),
): void {
  if (!isRealDate(startDate) || !isRealDate(endDate)) {
    badRequest("Dates must be valid calendar dates (YYYY-MM-DD).");
  }
  if (startDate < todayUtc(now)) badRequest("The start date is in the past.");
  if (endDate < startDate) badRequest("The end date is before the start date.");
  if (daysBetween(startDate, endDate) > MAX_LOAN_DAYS) {
    badRequest(`Loans can last at most ${MAX_LOAN_DAYS} days.`);
  }
}

/** Inclusive date ranges overlap. */
export function rangesOverlap(
  a: { startDate: string; endDate: string },
  b: { startDate: string; endDate: string },
): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

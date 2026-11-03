import { badRequest } from "./auth";
import { daysBetween, isoDay, loanDateError, MAX_LOAN_DAYS } from "./rules";

export { daysBetween, MAX_LOAN_DAYS };

export function todayUtc(now: number = Date.now()): string {
  return isoDay(now);
}

export function validateLoanDates(
  startDate: string,
  endDate: string,
  now: number = Date.now(),
): void {
  const error = loanDateError(startDate, endDate, now);
  if (error) badRequest(error);
}

/** Inclusive date ranges overlap. */
export function rangesOverlap(
  a: { startDate: string; endDate: string },
  b: { startDate: string; endDate: string },
): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

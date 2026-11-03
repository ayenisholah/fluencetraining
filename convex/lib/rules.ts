// Validation rules shared by the Convex functions (authoritative) and the
// forms (instant feedback). Pure functions with no Convex imports, so the
// browser bundle can use them too.

export const TOOL_NAME_MIN = 2;
export const TOOL_NAME_MAX = 80;
export const TOOL_DESCRIPTION_MAX = 500;
export const MAX_LOAN_DAYS = 30;

export type ToolFieldErrors = { name?: string; description?: string };

export function toolFieldErrors(fields: {
  name: string;
  description: string;
}): ToolFieldErrors {
  const errors: ToolFieldErrors = {};
  const name = fields.name.trim();
  if (name.length < TOOL_NAME_MIN) errors.name = "Give the tool a name (at least 2 characters).";
  else if (name.length > TOOL_NAME_MAX) errors.name = `Keep the name under ${TOOL_NAME_MAX} characters.`;
  if (fields.description.trim().length > TOOL_DESCRIPTION_MAX) {
    errors.description = `Keep the description under ${TOOL_DESCRIPTION_MAX} characters.`;
  }
  return errors;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
  );
}

function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && isoDay(parsed.getTime()) === value;
}

/** The first problem with a requested date range, or undefined if it's valid. */
export function loanDateError(
  startDate: string,
  endDate: string,
  now: number = Date.now(),
): string | undefined {
  if (!isRealDate(startDate) || !isRealDate(endDate)) {
    return "Pick both dates.";
  }
  if (startDate < isoDay(now)) return "The start date is in the past.";
  if (endDate < startDate) return "The end date is before the start date.";
  if (daysBetween(startDate, endDate) > MAX_LOAN_DAYS) {
    return `Loans can last at most ${MAX_LOAN_DAYS} days.`;
  }
  return undefined;
}

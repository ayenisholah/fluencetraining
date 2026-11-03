import { ConvexError } from "convex/values";

export const CATEGORIES = [
  ["power_tools", "Power tools"],
  ["hand_tools", "Hand tools"],
  ["garden", "Garden"],
  ["kitchen", "Kitchen"],
  ["camping", "Camping"],
  ["cleaning", "Cleaning"],
  ["other", "Other"],
] as const;

export type Category = (typeof CATEGORIES)[number][0];

export const CONDITIONS = [
  ["new", "Like new"],
  ["good", "Good"],
  ["fair", "Fair"],
  ["worn", "Well used"],
] as const;

export type Condition = (typeof CONDITIONS)[number][0];

const categoryLabels = Object.fromEntries(CATEGORIES) as Record<string, string>;
const conditionLabels = Object.fromEntries(CONDITIONS) as Record<string, string>;

export const categoryLabel = (c?: string) => (c ? categoryLabels[c] ?? c : "");
export const conditionLabel = (c: string) => conditionLabels[c] ?? c;

export function errorMessage(err: unknown): string {
  if (err instanceof ConvexError) {
    const data = err.data as { message?: string } | string;
    return typeof data === "string" ? data : data.message ?? "Something went wrong.";
  }
  return "Something went wrong. Please try again.";
}

export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function timeAgo(ms: number, now: number = Date.now()): string {
  const minutes = Math.round((now - ms) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export function todayIso(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

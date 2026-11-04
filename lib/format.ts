import { ConvexError } from "convex/values";
import type { Doc } from "@/convex/_generated/dataModel";
import { CATEGORY_STYLES, type Category, type CategoryStyle } from "./categories";

export type { Category } from "./categories";
export type Condition = Doc<"tools">["condition"];

// Keyed by the schema's own union, so adding a condition in convex/schema.ts is
// a type error here until it has a label. Category labels live with their
// colour and icon in lib/categories.tsx.
const conditionLabels: Record<Condition, string> = {
  new: "Like new",
  good: "Good",
  fair: "Fair",
  worn: "Well used",
};

/** [value, label] pairs in display order, for selects and filters. */
export const CATEGORIES = (Object.entries(CATEGORY_STYLES) as [Category, CategoryStyle][]).map(
  ([value, style]) => [value, style.label] as [Category, string],
);
export const CONDITIONS = Object.entries(conditionLabels) as [Condition, string][];

export const categoryLabel = (c?: string) => (c ? (CATEGORY_STYLES[c as Category]?.label ?? c) : "");
export const conditionLabel = (c: string) => conditionLabels[c as Condition] ?? c;

export function errorMessage(err: unknown): string {
  if (err instanceof ConvexError) {
    const data = err.data as { message?: string } | string;
    return typeof data === "string" ? data : (data.message ?? "Something went wrong.");
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

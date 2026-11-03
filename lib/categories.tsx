// The one place a category's presentation is defined: label, preset colour and
// icon. Keyed by the schema's own union, so a new category in convex/schema.ts
// fails the type check here until it has all three. Insertion order is
// display order.
import type { ComponentType } from "react";
import type { PresetColor } from "@/components/ui/Badge/Badge";
import { BoltIcon, BoxIcon, PotIcon, SparkleIcon, SproutIcon, TentIcon, WrenchIcon, type IconProps } from "@/components/ui/icons";
import type { Doc } from "@/convex/_generated/dataModel";

export type Category = Doc<"tools">["category"];

export type CategoryStyle = { label: string; color: PresetColor; Icon: ComponentType<IconProps> };

export const CATEGORY_STYLES: Record<Category, CategoryStyle> = {
  power_tools: { label: "Power tools", color: "orange", Icon: BoltIcon },
  hand_tools: { label: "Hand tools", color: "blue", Icon: WrenchIcon },
  garden: { label: "Garden", color: "green", Icon: SproutIcon },
  kitchen: { label: "Kitchen", color: "pink", Icon: PotIcon },
  camping: { label: "Camping", color: "emerald", Icon: TentIcon },
  cleaning: { label: "Cleaning", color: "sky", Icon: SparkleIcon },
  other: { label: "Other", color: "violet", Icon: BoxIcon },
};

export function categoryStyle(category: string | undefined): CategoryStyle {
  return CATEGORY_STYLES[category as Category] ?? CATEGORY_STYLES.other;
}

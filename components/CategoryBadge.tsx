import { Badge } from "@/components/ui";
import { categoryStyle } from "@/lib/categories";
import { cn } from "@/lib/cn";

/** A category as a tag: its preset colour, icon and label (lib/categories.tsx). */
export function CategoryBadge({ category, className }: { category: string | undefined; className?: string }) {
  const { label, color, Icon } = categoryStyle(category);
  return (
    <Badge color={color} className={cn("gap-1.5", className)}>
      <Icon size={14} />
      {label}
    </Badge>
  );
}

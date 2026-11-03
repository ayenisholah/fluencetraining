import { PRESET_COLORS } from "@/components/ui";
import { categoryStyle } from "@/lib/categories";
import { cn } from "@/lib/cn";

/**
 * A tool's photo at a fixed aspect ratio, or, without one, a tile in the
 * category's preset colour with its icon, so the grid never has gaps.
 */
export function ToolImage({
  src,
  name,
  category,
  className,
  iconSize = 40,
}: {
  src: string | null | undefined;
  name: string;
  category: string;
  className?: string;
  iconSize?: number;
}) {
  const { color, Icon } = categoryStyle(category);
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- served from Convex storage; next/image would need remotePatterns per deployment
    return <img src={src} alt={name} loading="lazy" decoding="async" className={cn("aspect-[4/3] w-full bg-surface-sunken object-cover", className)} />;
  }
  return (
    <div aria-hidden className={cn("flex aspect-[4/3] w-full items-center justify-center", PRESET_COLORS[color], className)}>
      <Icon size={iconSize} />
    </div>
  );
}

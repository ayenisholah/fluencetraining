import { cn } from "@/lib/cn";

export const AVATAR_SIZES = [16, 20, 24, 28, 32, 36, 40, 48, 64] as const;
export type AvatarSize = (typeof AVATAR_SIZES)[number];

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

const statusColor = { online: "bg-accent-green", away: "bg-accent-orange", offline: "bg-neutral-400" };

export type AvatarProps = {
  name: string;
  src?: string;
  size?: AvatarSize;
  status?: keyof typeof statusColor;
  className?: string;
};

/** Circular avatar: image when given, otherwise initials. */
export function Avatar({ name, src, size = 40, status, className }: AvatarProps) {
  const font = Math.max(8, Math.round(size * 0.38));
  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatars may come from any host
        <img src={src} alt={name} width={size} height={size} className="size-full rounded-full object-cover" />
      ) : (
        <span
          role="img"
          aria-label={name}
          className="flex size-full items-center justify-center rounded-full bg-brand-soft font-semibold text-brand-fg"
          style={{ fontSize: font }}
        >
          {initials(name)}
        </span>
      )}
      {status && (
        <span
          aria-label={status}
          role="img"
          className={cn(
            "absolute right-0 bottom-0 rounded-full ring-2 ring-surface",
            statusColor[status],
          )}
          style={{ width: Math.max(6, size / 4), height: Math.max(6, size / 4) }}
        />
      )}
    </span>
  );
}

/** Overlapping stack with a "+N" overflow bubble. */
export function AvatarGroup({
  people,
  max = 4,
  size = 32,
}: {
  people: { name: string; src?: string }[];
  max?: number;
  size?: AvatarSize;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className="inline-flex items-center -space-x-2" aria-label={`${people.length} people`} role="group">
      {shown.map((p) => (
        <Avatar key={p.name} {...p} size={size} className="rounded-full ring-2 ring-surface" />
      ))}
      {rest > 0 && (
        <span
          className="flex items-center justify-center rounded-full bg-surface-sunken text-description font-semibold text-fg-muted ring-2 ring-surface"
          style={{ width: size, height: size }}
        >
          +{rest}
        </span>
      )}
    </span>
  );
}

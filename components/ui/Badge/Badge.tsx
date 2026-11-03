import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

// Figma "Badges": solid / dim / ghost, as a text pill or a round count
// "bubble". `tone` adds the status colours used across the app.
export const badgeVariants = cva(
  "inline-flex items-center justify-center gap-1 whitespace-nowrap font-medium",
  {
    variants: {
      variant: {
        solid: "",
        dim: "",
        ghost: "border bg-transparent",
        soft: "",
      },
      tone: {
        neutral: "",
        brand: "",
        success: "",
        warning: "",
        danger: "",
        info: "",
      },
      shape: {
        pill: "h-[25px] rounded-pill px-2.5 text-description",
        bubble: "size-[25px] rounded-full text-description",
      },
    },
    compoundVariants: [
      { variant: "solid", tone: "neutral", className: "bg-neutral-1000 text-neutral-0" },
      { variant: "solid", tone: "brand", className: "bg-brand text-on-brand" },
      { variant: "solid", tone: "danger", className: "bg-danger-solid text-white" },
      { variant: "dim", className: "bg-dim text-on-dim" },
      { variant: "ghost", tone: "neutral", className: "border-dim text-fg-muted" },
      { variant: "ghost", tone: "brand", className: "border-brand text-brand-fg" },
      { variant: "soft", tone: "neutral", className: "bg-surface-sunken text-fg-muted" },
      { variant: "soft", tone: "brand", className: "bg-brand-soft text-brand-fg" },
      { variant: "soft", tone: "success", className: "bg-success-soft text-success" },
      { variant: "soft", tone: "warning", className: "bg-warning-soft text-warning" },
      { variant: "soft", tone: "danger", className: "bg-danger-soft text-danger" },
      { variant: "soft", tone: "info", className: "bg-info-soft text-info" },
    ],
    defaultVariants: { variant: "soft", tone: "neutral", shape: "pill" },
  },
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, tone, shape, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, tone, shape }), className)} {...props} />;
}

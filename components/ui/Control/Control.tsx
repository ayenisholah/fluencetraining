import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { intentClasses } from "../Button/variants";

// Pill-shaped controls (Figma "Controls"): body label, caption label, icon.
export const controlVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-pill font-semibold outline-none transition-[box-shadow,background-color,color] disabled:cursor-not-allowed [&_svg]:size-4",
  {
    variants: {
      variant: intentClasses,
      kind: {
        body: "h-9 px-4 text-mini-button-label",
        caption: "h-7 px-3 text-description font-semibold",
        icon: "size-9 p-0",
      },
    },
    defaultVariants: { variant: "solid", kind: "body" },
  },
);

export type ControlProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof controlVariants>;

export const Control = forwardRef<HTMLButtonElement, ControlProps>(function Control(
  { className, variant, kind, type = "button", ...props },
  ref,
) {
  return <button ref={ref} type={type} className={cn(controlVariants({ variant, kind }), className)} {...props} />;
});

/** Round icon-only control. `label` is required because there's no visible text. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  Omit<ControlProps, "kind" | "aria-label"> & { label: string }
>(function IconButton({ label, children, ...props }, ref) {
  return (
    <Control ref={ref} kind="icon" aria-label={label} title={label} {...props}>
      {children}
    </Control>
  );
});

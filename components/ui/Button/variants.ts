import { cva, type VariantProps } from "class-variance-authority";

// Shared solid / dim / ghost colours for Button and Control (Figma "Buttons"
// and "Controls"). Hover and keyboard focus draw the 4px focus ring; disabled
// controls don't react to hover.
export const intentClasses = {
  solid:
    "bg-brand text-on-brand enabled:hover:ring-4 enabled:hover:ring-state-focus focus-visible:ring-4 focus-visible:ring-focus-ring disabled:text-brand-disabled-fg",
  dim: "bg-dim text-on-dim enabled:hover:bg-transparent enabled:hover:text-fg enabled:hover:ring-4 enabled:hover:ring-[rgba(153,153,153,0.5)] focus-visible:bg-transparent focus-visible:text-fg focus-visible:ring-4 focus-visible:ring-[rgba(153,153,153,0.5)] disabled:bg-[rgba(158,158,158,0.25)] disabled:text-[rgba(153,153,153,0.7)]",
  ghost:
    "bg-transparent text-fg border border-dim enabled:hover:ring-4 enabled:hover:ring-[rgba(153,153,153,0.5)] focus-visible:ring-4 focus-visible:ring-[rgba(153,153,153,0.5)] disabled:border-ghost-disabled disabled:text-ghost-disabled",
  danger:
    "bg-danger-solid text-white enabled:hover:ring-4 enabled:hover:ring-danger-soft focus-visible:ring-4 focus-visible:ring-danger-soft disabled:opacity-60",
} as const;

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-semibold outline-none transition-[box-shadow,background-color,color] disabled:cursor-not-allowed [&_svg]:shrink-0",
  {
    variants: {
      variant: intentClasses,
      size: {
        lg: "h-14 rounded-lg px-6 text-button-label [&_svg]:size-6",
        md: "h-[42px] rounded-md px-5 text-mini-button-label [&_svg]:size-5",
        sm: "h-8 rounded-sm px-3 text-description font-semibold [&_svg]:size-4",
      },
      fullWidth: { true: "w-full" },
    },
    defaultVariants: { variant: "solid", size: "md" },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;

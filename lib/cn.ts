import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge the design-system type scale so `text-body` and
// `text-fg` don't get treated as conflicting font-size classes.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "h1",
            "h2",
            "h4",
            "h5",
            "h6",
            "h7",
            "subtitle",
            "subtitle-semibold",
            "body",
            "body-bold",
            "button-label",
            "mini-button-label",
            "description",
            "mini-description",
          ],
        },
      ],
    },
  },
});

/** Merge class names, letting later Tailwind classes override earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

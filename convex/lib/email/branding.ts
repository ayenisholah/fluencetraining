// Email branding. Email clients can't read CSS variables, so the Frox tokens
// are repeated here as literals; email.test.ts checks they still match
// lib/brand.tsx and app/globals.css (day theme).

export const EMAIL_COLORS = {
  brand: "#7364db", // lib/brand.tsx brand.violet
  brandText: "#5b4cc6", // --brand-fg
  lilac: "#b2a7ff", // brand.lilac
  paper: "#f5f5fa", // brand.paper / --canvas
  surface: "#ffffff",
  ink: "#16161e", // brand.ink / --fg
  muted: "#636373", // brand.muted / --fg-muted
  border: "#e2e2ea", // --line
  sunken: "#f9f9fc",
  success: "#0f7a5f",
  successSoft: "#e3f7f1",
  warning: "#9c4a14",
  warningSoft: "#fdefe6",
  neutral: "#636373",
  neutralSoft: "#f0f0f5",
} as const;

/** Category preset colours, day theme (app/globals.css --preset-*). */
export const EMAIL_PRESETS = {
  orange: { text: "#9a4a10", soft: "#fdeee3" },
  blue: { text: "#1d5fd6", soft: "#e7efff" },
  green: { text: "#237a3b", soft: "#e6f6ea" },
  pink: { text: "#b02a6b", soft: "#fde8f2" },
  emerald: { text: "#0f7a5f", soft: "#e1f6ef" },
  sky: { text: "#0b6a80", soft: "#e0f5fa" },
  violet: { text: "#6a3dbb", soft: "#f0e9fb" },
} as const;

/** Category → label and preset, mirroring lib/categories.tsx (which the backend can't import: it holds React icons). */
export const EMAIL_CATEGORIES: Record<string, { label: string; color: keyof typeof EMAIL_PRESETS }> = {
  power_tools: { label: "Power tools", color: "orange" },
  hand_tools: { label: "Hand tools", color: "blue" },
  garden: { label: "Garden", color: "green" },
  kitchen: { label: "Kitchen", color: "pink" },
  camping: { label: "Camping", color: "emerald" },
  cleaning: { label: "Cleaning", color: "sky" },
  other: { label: "Other", color: "violet" },
};

/** Public app URL for links and the logo (Convex env LENDLOOP_APP_URL). */
export function emailAppUrl(): string {
  return (process.env.LENDLOOP_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** PNG mark (Gmail and Outlook block SVG): the app's generated apple-icon. */
export function emailLogoUrl(): string {
  return `${emailAppUrl()}/apple-icon`;
}

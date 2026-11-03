// WCAG 2.1 contrast check for the colour tokens in app/globals.css, in both
// the light and dark themes. Exits non-zero if any pair the UI actually uses
// falls below AA (4.5:1 for normal text, 3:1 for large text and UI borders).
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function tokens(block) {
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]),
  );
}
const light = tokens(css.match(/:root\s*{([^}]*)}/)[1]);
const dark = tokens(css.match(/prefers-color-scheme:\s*dark\)\s*{\s*:root\s*{([^}]*)}/)[1]);

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [text token, background token, minimum, where it's used]
const pairs = [
  ["foreground", "background", 4.5, "body text"],
  ["foreground", "surface", 4.5, "card text"],
  ["muted", "background", 4.5, "secondary text, footer"],
  ["muted", "surface", 4.5, "card metadata"],
  ["accent", "surface", 4.5, "links, wordmark"],
  ["accent", "accent-soft", 4.5, "Available / active nav badge"],
  ["surface", "accent", 4.5, "primary button label"],
  ["warn", "warn-soft", 4.5, "Requested / On loan badge, demo notice"],
  ["danger", "danger-soft", 4.5, "Overdue badge"],
  ["danger", "surface", 4.5, "field errors, Delete button"],
];

let failed = 0;
for (const [theme, t] of [["light", light], ["dark", dark]]) {
  console.log(`\n${theme}`);
  for (const [fg, bg, min, use] of pairs) {
    const r = ratio(t[fg], t[bg]);
    const ok = r >= min;
    if (!ok) failed++;
    console.log(`  ${ok ? "ok  " : "FAIL"} ${r.toFixed(2).padStart(5)}:1  ${fg} on ${bg}  (${use})`);
  }
}
if (failed) {
  console.error(`\n${failed} pair(s) below WCAG AA.`);
  process.exit(1);
}
console.log("\nAll colour pairs meet WCAG AA.");

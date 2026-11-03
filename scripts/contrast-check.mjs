// WCAG 2.1 contrast check for the design-system tokens in app/globals.css,
// in both themes. Resolves var() references, so it checks what components
// actually render. Exits non-zero if any pair the UI uses fails AA.
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function block(selector) {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`missing ${selector}`);
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error(`unclosed ${selector}`);
}

function vars(text) {
  return Object.fromEntries(
    [...text.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
  );
}

const day = vars(block(":root {"));
const night = { ...day, ...vars(block(':root[data-theme="dark"] {')) };

function resolve(theme, name, seen = new Set()) {
  const raw = theme[name];
  if (raw === undefined) throw new Error(`unknown token --${name}`);
  const ref = raw.match(/^var\(--([\w-]+)\)$/);
  if (!ref) return raw;
  if (seen.has(name)) throw new Error(`cycle at --${name}`);
  seen.add(name);
  return resolve(theme, ref[1], seen);
}

function rgb(color) {
  if (color.startsWith("#")) {
    const h = color.length === 4 ? color.replace(/#(.)(.)(.)/, "#$1$1$2$2$3$3") : color;
    return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  throw new Error(`can't parse colour ${color}`);
}
function luminance(color) {
  const [r, g, b] = rgb(color).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// [foreground, background, minimum, where it's used]. Literal colours start with #.
const pairs = [
  ["fg", "canvas", 4.5, "body text on page"],
  ["fg", "surface", 4.5, "card text"],
  ["fg-muted", "canvas", 4.5, "secondary text on page"],
  ["fg-muted", "surface", 4.5, "card metadata"],
  ["fg-muted", "surface-sunken", 4.5, "secondary text on sunken areas"],
  ["fg-subtle", "surface", 3, "icons and large text only"],
  ["brand-fg", "surface", 4.5, "links, active labels"],
  ["brand-fg", "brand-soft", 4.5, "brand badge, count bubble"],
  ["on-brand", "brand", 4.5, "solid button / active sidebar item"],
  ["on-dim", "dim", 4.5, "dim button"],
  ["#ffffff", "segmented-track", 4.5, "segmented control labels"],
  ["fg", "field-bg", 4.5, "field value"],
  ["field-placeholder", "field-bg", 4.5, "field placeholder"],
  ["field-label", "field-bg", 4.5, "floating field label"],
  ["fg", "surface", 4.5, "focused field value"],
  ["#ffffff", "danger-solid", 4.5, "error caption bar, danger button"],
  ["danger", "surface", 4.5, "error text"],
  ["danger", "danger-soft", 4.5, "danger badge / alert"],
  ["success", "success-soft", 4.5, "success badge / alert"],
  ["success", "surface", 4.5, "positive delta"],
  ["warning", "warning-soft", 4.5, "warning badge / notice"],
  ["info", "info-soft", 4.5, "info badge / alert"],
  ["preset-orange", "preset-orange-soft", 4.5, "orange preset badge (categories)"],
  ["preset-orange", "surface", 4.5, "orange preset text on cards"],
  ["preset-blue", "preset-blue-soft", 4.5, "blue preset badge (categories)"],
  ["preset-blue", "surface", 4.5, "blue preset text on cards"],
  ["preset-green", "preset-green-soft", 4.5, "green preset badge (categories)"],
  ["preset-green", "surface", 4.5, "green preset text on cards"],
  ["preset-pink", "preset-pink-soft", 4.5, "pink preset badge (categories)"],
  ["preset-pink", "surface", 4.5, "pink preset text on cards"],
  ["preset-emerald", "preset-emerald-soft", 4.5, "emerald preset badge (categories)"],
  ["preset-emerald", "surface", 4.5, "emerald preset text on cards"],
  ["preset-sky", "preset-sky-soft", 4.5, "sky preset badge (categories)"],
  ["preset-sky", "surface", 4.5, "sky preset text on cards"],
  ["preset-violet", "preset-violet-soft", 4.5, "violet preset badge (categories)"],
  ["preset-violet", "surface", 4.5, "violet preset text on cards"],
  ["focus-ring", "surface", 3, "keyboard focus ring (non-text, 3:1)"],
  ["focus-ring", "canvas", 3, "keyboard focus ring on page"],
  ["line-strong", "surface", 1.0, "(decorative border, not checked)"],
];

let failed = 0;
for (const [label, theme] of [["day", day], ["night", night]]) {
  console.log(`\n${label}`);
  for (const [fg, bg, min, use] of pairs) {
    if (min <= 1) continue;
    const a = fg.startsWith("#") ? fg : resolve(theme, fg);
    const b = bg.startsWith("#") ? bg : resolve(theme, bg);
    const r = ratio(a, b);
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

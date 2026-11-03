# Frox Dashboard Design System

Source: Figma file `Frox_dashboard_v5` (fileKey `jWHhIpI52m6ABnQpcTzZkG`), page "Design System" (node `868:14739`).
Values below come from the file's Figma variables and component specs unless marked **(approx)**, which means read off the canvas and worth verifying in Figma.

Use this as the source of truth when building UI. Don't hardcode hex values in components; reference the tokens.

---

## 1. Principles

- Dashboard UI, light ("day") and dark ("night") themes from the same token names.
- One brand color (violet `#7364DB`) carries all primary actions, active states and focus.
- Font is Poppins everywhere. Weight does the hierarchy work, not color.
- Generous radius: 16px on large buttons, 12px on nav items, 8px on inputs, pills for controls.
- Icons: Vuesax "linear" set, 24px default (22px in sidebar), stroke style.

---

## 2. Color tokens

### Brand and state

| Token | Value | Use |
|---|---|---|
| `brand-1` | `#7364DB` | Primary buttons, active nav, links on hover, toggles on |
| `state-hover` | `#7364DB` | Hover text/icon color on nav items |
| `state-focus` | `#B2A7FF` | Focus ring / hover border (4px) on buttons, fields |
| `focus-glow` | `rgba(48,127,226,0.6)` | 4px outer glow on focused input |

### Neutrals, day (light theme)

| Token | Value |
|---|---|
| `neutral-0` | `#FFFFFF` |
| `neutral-100` | `#F5F5FA` |
| `neutral-200` | `#E2E2EA` |
| `neutral-300` | `#C6CBD9` |
| `neutral-400` | `#9A9AAF` |
| `neutral-500` | `#7E7E8F` |
| `neutral-600` | `#656575` |
| `neutral-700` | `#535362` |
| `neutral-800` | `#2E2E3A` |
| `neutral-900` | `#262631` |
| `neutral-1000` | `#16161E` |
| `neutral-1100` | `#07070C` |

### Neutrals, night (dark theme)

| Token | Value |
|---|---|
| `neutral-0` | `#000000` |
| `neutral-100` | `#0F0F12` |
| `neutral-200` | `#1E1E24` |
| `neutral-300` | `#2C2C35` |
| `neutral-400` | `#64646F` |
| `neutral-500` | `#8B8B93` |
| `neutral-600` | `#70707C` |
| `neutral-700` | `#8A8A98` |
| `neutral-800` | `#A9A9B7` |
| `neutral-900` | `#D0D0DA` |
| `neutral-1000` | `#EAEAF4` |
| `neutral-1100` | `#F1F1F1` |
| `neutral-bg` | `#1F2128` (dark app background) |

Same token name maps to the opposite end of the scale per theme, so `neutral-1000` is near-black text in day and near-white text in night. Build theme switching on that.

### Accents (charts, tags, category colors)

| Token | Value |
|---|---|
| `accent-blue` | `#2775FF` |
| `accent-green` | `#50D1B2` |
| `accent-emerald` | `#5EEA8D` |
| `accent-yellow` | `#ECE663` |
| `accent-orange` | `#EC8C56` |
| `accent-red` | `#E23738` (also error) |
| `accent-pink` | `#FB7BB8` |
| `accent-fuchsia` | `#DD50D6` |
| `accent-violet` | `#7747CA` |
| `accent-indigo` | `#5415F1` |
| `accent-sky` | `#0BD6F4` |

### Utility grays (used inside components)

| Token | Value |
|---|---|
| `gray-3` | `#4D4D4D` (disabled ghost border/text) |
| `gray-4` | `#707070` (disabled field text) |
| `gray-5` | `#999999` (field label) |
| `gray-6` | `#C4C4C4` (placeholder) |
| `overlay-gray` | `#9E9E9E` |

---

## 3. Typography

Font: **Poppins** (Google Fonts, weights 400, 500, 600, 700, 800).

| Token | Size / line-height | Weight | Letter spacing |
|---|---|---|---|
| `h1` | 40 / 60 | 700 | 0 |
| `h2` | 32 / 39 | 800 | 0 |
| `h4` | 28 / 34 | 600 | 0 |
| `h5` | 24 / 30 | 700 | 0.11px |
| `h6` | 20 / 18 | 600 | 0 |
| `h7` | 18 / 22 | 700 | 0 |
| `subtitle` | 16 / 16 | 500 | -0.9px |
| `subtitle-semibold` | 16 / 20 | 600 | 0 |
| `text` | 14 / 16 | 400 | 0 |
| `text-bold` | 14 / 16 | 600 | 0 |
| `button-label` | 16 / 16 | 700 | -0.9px |
| `mini-button-label` | 14 / 20 | 600 | -0.9px |
| `description` | 12 / 16 | 400 | 0 |
| `mini-description` | 9 / 11 | 400 | 5px (uppercase-style tracking) |

Note: no `h3` variable exists in the file. If needed, interpolate (e.g. 30 / 36, 600).
Note: `h6` line-height 18 is smaller than its size in Figma; use 24 in code to avoid clipping.

---

## 4. Spacing, radius, elevation

- Spacing base: 4px. Observed steps: 4, 6, 8, 12, 16, 20, 24 **(approx, no spacing variables in file)**.
- Radius:
  - `radius-sm` 8px: inputs, small buttons **(approx for sm button)**
  - `radius-md` 12px: sidebar items, medium buttons **(approx for md button)**
  - `radius-lg` 16px: large buttons, cards **(approx for cards)**
  - `radius-pill` 9999px: controls, segmented control, toggles, badges bubble
- Focus treatment: 4px border in `state-focus` (`#B2A7FF`). Inputs additionally get `0 0 0 4px rgba(48,127,226,0.6)`.
- Shadows: cards are flat on the canvas; use a soft shadow sparingly if needed.

---

## 5. Components

### Button

Sizes: `lg` 56h, `md` 42h, `sm` 32h. Horizontal padding 24px (lg), gap 8px between icon and label. Label: Poppins SemiBold 14, line-height 1.5.

| Style / state | Background | Border | Text |
|---|---|---|---|
| solid / rest | `#7364DB` | none | `#FFFFFF` |
| solid / hover-focus | `#7364DB` | 4px `#B2A7FF` | `#FFFFFF` |
| solid / disabled | `#7364DB` | none | `#B8B1E4` |
| dim / rest | `#7E7E8F` | none | `#FFFFFF` |
| dim / hover-focus | transparent | 4px `rgba(153,153,153,0.5)` | `#16161E` |
| dim / disabled | `rgba(158,158,158,0.25)` | none | `rgba(153,153,153,0.5)` |
| ghost / rest | transparent | 1px `#7E7E8F` | `#16161E` |
| ghost / hover-focus | transparent | 4px `rgba(153,153,153,0.5)` | `#16161E` |
| ghost / disabled | transparent | 1px `#4D4D4D` | `#4D4D4D` |

Radius: lg 16px. md and sm scale down (12px, 8px **approx**).

### Control (pill button) and segmented control

- Pill shape, ~36h. Types: `body label`, `caption label`, `icon` (36x36 circle).
- Same solid / dim / ghost styling and rest / hover-focus / disabled states as Button.
- Segmented control: dark pill track (`neutral-1000` day), active segment filled `#7364DB`, others plain white text.

### Text field

306w default, radius 8px, padding 12px 16px (rest/hover), 6px 16px when label floats.

| State | Styling |
|---|---|
| rest | bg `#9A9AAF`, placeholder `#C4C4C4` 14px |
| hover | transparent, 4px border `#B2A7FF` |
| focused | bg `#000000`, 1px border `#B2A7FF`, glow `0 0 0 4px rgba(48,127,226,0.6)`, height 48, floating label 12px `#999` above input 14px white |
| filled | bg `#9A9AAF`, height 48, floating label + white value |
| error | 1px border `#E23738`, field on top, red caption bar below (`#E23738`, white 14px text, 16px warning icon, padding 4px 16px) |
| disabled | bg `#9A9AAF` (dimmed), text `#707070` |

### Toggle

- 56x32 pill. States: on (track `#7364DB`, knob right), off (lighter violet track, knob left), focus (focus ring), disabled (faded).
- "Toggle + Text" variant: small inline toggle with 14px label to the right, 24h row.

### Checkbox and radio

- 20x20. Off: 1px neutral border. On: filled `#7364DB` with white check / dot.

### Slider

- Range selector, 4px track, filled segment `#7364DB`, round white thumbs, value labels above thumbs, min/max labels below.

### Badge

- Styles: solid (dark fill, white text), dim, ghost (1px border). Two shapes: `badge` (62x25 pill with text) and `bubble` (25x25 circle with a number).

### Dropdown item

- 187x46. Default: icon + label `#7E7E8F`. Hover/active: light neutral fill (`neutral-100`), text darkens.

### Left sidebar item

- Padding 17px 15px 17px 21px, radius 12px, icon 22px + label gap 10px, label Poppins SemiBold 14 / 16.
- Default: transparent, text and icon `#7E7E8F`.
- Hover: text and icon `#7364DB`.
- Active: bg `#7364DB`, text and icon white.

### Avatar

- Sizes: 16, 20, 24, 28, 32, 36, 40, 48, 64. Circular. Four rows of variants in Figma (image, initials, with status, group/stack).

### Widgets and charts

- Stat widgets around 182x220 ("Spend this week", "Total cashback", "Spending trend"): card, small label, big number, mini chart.
- Charts use the accent palette: line and area charts, bar charts, donut/pie, world map, progress bars. Default first series is `brand-1`, then blue, green, orange, pink.

---

## 6. Assets

- Logo: light and dark versions (113x30) plus favicon (28x24), Brand frame `1100:1680`.
- Icons: Vuesax linear, grouped by category (Essential, Arrow, Business, Users, Content, Messages, Time, Location, Search, Shop, Crypto, etc.) in Icons frame `1109:1607`. Use the `vuesax` icon pack or export SVGs from Figma.
- Rounded country flags in "Flags Rounded" frame.

---

## 7. Drop-in code

### CSS custom properties

```css
:root {
  --font-sans: "Poppins", system-ui, sans-serif;

  --brand-1: #7364DB;
  --state-focus: #B2A7FF;
  --focus-glow: rgba(48, 127, 226, 0.6);

  --neutral-0: #FFFFFF;
  --neutral-100: #F5F5FA;
  --neutral-200: #E2E2EA;
  --neutral-300: #C6CBD9;
  --neutral-400: #9A9AAF;
  --neutral-500: #7E7E8F;
  --neutral-600: #656575;
  --neutral-700: #535362;
  --neutral-800: #2E2E3A;
  --neutral-900: #262631;
  --neutral-1000: #16161E;
  --neutral-1100: #07070C;
  --neutral-bg: #F5F5FA;

  --accent-blue: #2775FF;
  --accent-green: #50D1B2;
  --accent-emerald: #5EEA8D;
  --accent-yellow: #ECE663;
  --accent-orange: #EC8C56;
  --accent-red: #E23738;
  --accent-pink: #FB7BB8;
  --accent-fuchsia: #DD50D6;
  --accent-violet: #7747CA;
  --accent-indigo: #5415F1;
  --accent-sky: #0BD6F4;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-pill: 9999px;
}

[data-theme="dark"] {
  --neutral-0: #000000;
  --neutral-100: #0F0F12;
  --neutral-200: #1E1E24;
  --neutral-300: #2C2C35;
  --neutral-400: #64646F;
  --neutral-500: #8B8B93;
  --neutral-600: #70707C;
  --neutral-700: #8A8A98;
  --neutral-800: #A9A9B7;
  --neutral-900: #D0D0DA;
  --neutral-1000: #EAEAF4;
  --neutral-1100: #F1F1F1;
  --neutral-bg: #1F2128;
}
```

`--neutral-bg` for day is set to `neutral-100` as a sensible default **(approx, no day BG variable in file)**.

### Tailwind theme extension

```js
// tailwind.config.js
module.exports = {
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: { sans: ["Poppins", "system-ui", "sans-serif"] },
      colors: {
        brand: { 1: "var(--brand-1)", focus: "var(--state-focus)" },
        neutral: {
          0: "var(--neutral-0)", 100: "var(--neutral-100)", 200: "var(--neutral-200)",
          300: "var(--neutral-300)", 400: "var(--neutral-400)", 500: "var(--neutral-500)",
          600: "var(--neutral-600)", 700: "var(--neutral-700)", 800: "var(--neutral-800)",
          900: "var(--neutral-900)", 1000: "var(--neutral-1000)", 1100: "var(--neutral-1100)",
          bg: "var(--neutral-bg)",
        },
        accent: {
          blue: "var(--accent-blue)", green: "var(--accent-green)", emerald: "var(--accent-emerald)",
          yellow: "var(--accent-yellow)", orange: "var(--accent-orange)", red: "var(--accent-red)",
          pink: "var(--accent-pink)", fuchsia: "var(--accent-fuchsia)", violet: "var(--accent-violet)",
          indigo: "var(--accent-indigo)", sky: "var(--accent-sky)",
        },
      },
      borderRadius: { sm: "8px", md: "12px", lg: "16px" },
      fontSize: {
        h1: ["40px", { lineHeight: "60px", fontWeight: "700" }],
        h2: ["32px", { lineHeight: "39px", fontWeight: "800" }],
        h4: ["28px", { lineHeight: "34px", fontWeight: "600" }],
        h5: ["24px", { lineHeight: "30px", fontWeight: "700" }],
        h6: ["20px", { lineHeight: "24px", fontWeight: "600" }],
        h7: ["18px", { lineHeight: "22px", fontWeight: "700" }],
        subtitle: ["16px", { lineHeight: "16px", fontWeight: "500", letterSpacing: "-0.9px" }],
        "subtitle-semibold": ["16px", { lineHeight: "20px", fontWeight: "600" }],
        text: ["14px", { lineHeight: "16px", fontWeight: "400" }],
        "text-bold": ["14px", { lineHeight: "16px", fontWeight: "600" }],
        "button-label": ["16px", { lineHeight: "16px", fontWeight: "700", letterSpacing: "-0.9px" }],
        "mini-button-label": ["14px", { lineHeight: "20px", fontWeight: "600", letterSpacing: "-0.9px" }],
        description: ["12px", { lineHeight: "16px", fontWeight: "400" }],
        "mini-description": ["9px", { lineHeight: "11px", fontWeight: "400", letterSpacing: "5px" }],
      },
    },
  },
};
```

---

## 8. Figma node reference (for pulling more detail with the Figma MCP)

| Section | Node ID |
|---|---|
| Design System page | `868:14739` |
| Brand (logo, favicon) | `1100:1680` |
| Typography | `869:12739` |
| Colors | `869:12721` |
| Avatar | `1105:1329` |
| Icons | `1109:1607` |
| Buttons & Form | `1109:9530` |
| Buttons (lg / md / sm sets) | `1110:2433` / `1175:5672` / `1175:5746` |
| Controls | `1110:2633` |
| Text field | `1111:2569` |
| Checkbox / Radio | `1111:2655` / `1111:2659` |
| Toggle / Toggle + Text | `1112:2687` / `1112:2794` |
| Slider | `1112:2913` |
| Badges | `1111:2697` |
| Dropdown item | `1153:2678` |
| Left sidebar item | `1155:2839` |
| Widgets | `1112:2920` |

Tip for Claude Code: when a component needs exact specs not listed here, call `get_design_context` on its node ID above rather than guessing.
---

## 9. Implementation in LendLoop

Everything above is implemented in this repo. Browse it in Storybook (`npm run storybook` → http://localhost:6006). The **Foundations** page shows every token with live contrast ratios in both themes.

| What | Where |
|---|---|
| Tokens: exact Figma scale, semantic aliases, Tailwind 4 `@theme` mapping, type scale | `app/globals.css` |
| Theme switching (`data-theme` on `<html>`, defaults to the OS, set before first paint) | `lib/theme.ts`, `components/ui/ThemeToggle` |
| Components (one folder each, with `*.test.tsx` and `*.stories.tsx`) | `components/ui/*`, exported from `components/ui/index.ts` |
| Class merging that understands the type scale | `lib/cn.ts` |
| App shell (sidebar ≥1024px, menu button below) | `components/shell/AppShell.tsx` |

**Component map (spec §5 → code):**
- Button → `Button` (`solid` / `dim` / `ghost`, plus `danger`; `lg` / `md` / `sm`; `loading`, icons). `buttonVariants()` styles links as buttons.
- Control → `Control` (`body` / `caption` / `icon`) and `IconButton`.
- Segmented control → `SegmentedControl`, an accessible radiogroup with arrow-key movement.
- Text field → `TextField` (floating label, hint, red caption bar, counter, `multiline`, `type="date"`) and `Select`.
- Toggle → `Toggle` (56×32, or the small "Toggle + Text" variant).
- Checkbox / radio → `Checkbox`, `Radio`.
- Slider → `RangeSlider`: two native range inputs, so both thumbs work with keyboard and screen readers.
- Badge → `Badge` (`solid` / `dim` / `ghost` / `soft`, `tone`, `pill` / `bubble`).
- Dropdown item → `DropdownMenu`, the WAI-ARIA menu-button pattern.
- Left sidebar item → `SidebarItem`.
- Avatar → `Avatar` (all nine sizes, initials fallback, status dot) and `AvatarGroup`.
- Widgets → `Card` / `CardHeader`, `StatWidget`.
- Also `Alert`, `EmptyState`, `Spinner`, `PageHeader` and an icon set in the Vuesax linear style (`components/ui/icons.tsx`).

**Checked against Figma.** The Buttons & Form (`1109:9530`), Left sidebar item (`1155:2839`) and Widgets (`1112:2920`) frames were compared with screenshots from the Figma file on 2026-11-03.

### AA adjustments

The raw Figma scale in `globals.css` is unchanged. Where a Figma pairing fails WCAG 2.1 AA, only the **semantic alias** that components use was changed. `npm run check:contrast` (in CI) checks 24 pairs in each theme. Storybook story tests and Playwright also run axe, including colour contrast, on the rendered pages.

| Use | Figma value | Value used (day) | Figma contrast | Now |
|---|---|---|---|---|
| Secondary text (`--fg-muted`) | neutral-500 #7E7E8F | #636373 | 3.99:1 (on white) | 5.89:1 |
| Dim button fill (`--dim`) | neutral-500 #7E7E8F | #6B6B7B | 3.99:1 (white label) | 5.23:1 |
| Field background (`--field-bg`) | #9A9AAF | neutral-100 #F5F5FA | white value text 2.76:1 | dark value text 16.55:1 |
| Field placeholder | gray-6 #C4C4C4 | #66667A | 1.58:1 on #9A9AAF | 5.16:1 on #F5F5FA |
| Field label | gray-5 #999999 | #636373 | 1.03:1 on #9A9AAF | 5.42:1 on #F5F5FA |
| Error text (`--danger`) | accent-red #E23738 | #B8292B | 4.34:1 (on white) | 6.19:1 |
| Error caption bar (`--danger-solid`) | accent-red #E23738 | #D42F30 | 4.34:1 (white text) | 4.94:1 |
| Info text (`--info`) | accent-blue #2775FF | #1D5FD6 | 3.58:1 (on info tint) | 4.97:1 |
| Keyboard focus ring (`--focus-ring`, day) | state-focus #B2A7FF | brand-1 #7364DB | 2.13:1 (on white, needs 3:1) | 4.59:1 |

What these changes mean in the UI:
- The rest/filled field is a light surface with dark text rather than the Figma mid-grey with white text. Hover still draws the 4px `#B2A7FF` border, and focus keeps the blue glow.
- `#B2A7FF` is still used for hover, as specified, since hover has no contrast requirement. Keyboard focus uses `--focus-ring`, which is `#B2A7FF` again in the night theme (6.71:1 on the dark card).
- `neutral-500` is still used as `--fg-subtle` for icons and large text, where 3:1 is enough.
- The night-theme card surface (`#282A33`) and the status colours on dark tints are marked **(approx)**: the file has no variables for them.

### Pagination composition

Pagination is derived from the Frox Control, Select and colour primitives above.
It is not an exact transcription of node `1169:12005`: that node could not be
read because the Figma MCP quota was exhausted.

- The footer has a `line` top divider, 16px top padding, and 16px between groups.
- The page-size selector uses `Select appearance="control"`: a 36px pill,
  a single-line value, and an inline visible label. Existing form selects keep
  their default field appearance and floating label.
- Pagination uses 40px page buttons, 8px corners, and a violet active square
  with `aria-current="page"`. First and last pages remain visible; up to seven
  slots show all pages or nearby pages separated by noninteractive ellipses.
  Previous/Next are outlined arrow buttons, disabled at the boundaries.
- The selector references its single visible label. Muted result text shows
  the range, for example “Showing 41–50 of 105 tools”; empty results show “0 tools”.
- Container queries place summary and navigation side by side from 60rem.
  Smaller containers stack them; below 36rem, page numbers sit above the
  Previous/Next row. This also accommodates narrow admin panels.
- All colours come from semantic tokens, including day/night backgrounds,
  disabled states and focus treatments. Existing AA adjustments still apply.
- Numbered server pages support direct jumps and exact matching totals. Page
  sizes are 10, 25, 50 and 100. Filters and size changes reset to page one.
  Counts currently scan the matching index for the small demo catalogue; larger
  deployments should maintain counts to avoid query read limits.

### Testing

| Layer | Command | What runs |
|---|---|---|
| Unit and component | `npm run test:ui` | Vitest + Testing Library + axe-core (jsdom): every component's variants, states, keyboard behaviour and ARIA wiring, plus `lib/*` logic |
| Stories | `npm run test:storybook` | Every story renders in Chrome, runs its play function, then axe at `a11y: "error"` |
| End to end | `npm run test:e2e` | Playwright: signed-out pages on desktop and mobile in both themes; with Clerk keys and the local stack, the full lend → borrow → approve → return flow |

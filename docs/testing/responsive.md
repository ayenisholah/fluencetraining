# Responsive layout verification

Run `npm run test:responsive` against the local app with Clerk development keys
and the Docker backend running. The suite uses the Clerk setup project and one
worker, with a separate artifact directory so other suites cannot delete its traces. It creates a uniquely named `E2E responsive …` listing and removes it in
`finally`. It opens borrowing and removal dialogs without submitting those actions.

## Layout rules

Page layouts use Tailwind's default mobile-first breakpoints: `sm` (640px), `md`
(768px), `lg` (1024px), `xl` (1280px), and `2xl` (1536px). The sidebar appears at
`lg`; My listings stays stacked until `xl` so the sidebar and listing form do not
squeeze the list simultaneously. Tiles progress from one column on phones to two
at `sm`, three at `xl`, and four at `2xl`.

Nested forms use container queries because a desktop tile can be narrower than a
phone page. Listing category/condition fields split at 24rem of available form
width; borrowing dates split at 40rem. Shared cards permit long words to wrap,
fields can shrink, and segmented controls and pagination can wrap when necessary.
Admin row checkboxes stay aligned; small screens omit decorative thumbnails to
leave space for the listing name and Remove action.

Phone calendars are positioned inside the viewport, with a scrollable height
limit; from `md` they anchor to their field. Cards do not clip open calendars.
Confirmation dialogs also have a viewport-based height limit. No global
horizontal-overflow suppression is used.

## Browser coverage

- Public home and legal pages; tools in cards, tiles and list views; listings,
  incoming loans, requests, and every Admin section.
- Light and dark themes at 320, 375, 639, 640, 767, 768, 1023, 1024, 1279, 1280,
  and 1536 CSS pixels. Adjacent widths exercise layout transitions.
- A long unbroken tool name, open borrowing calendars, listing edits, bulk
  selection, confirmation dialogs and mobile navigation at representative widths.
- Screenshots of phone borrowing calendars and Admin sections in Playwright's
  `playwright-responsive-results` directory, alongside assertions for overflow and calendar bounds.

The page sweep uses the data already present in the local stack. The separate
interactive test supplies its own listing so populated listing/form coverage does
not depend on seed data. Browser layout assertions supplement component tests;
jsdom alone cannot verify responsive geometry.

## Verification results — 2026-11-03

The loaded-page sweep passed all 220 viewport/theme/page combinations. The final
focused interaction run passed in both themes at all seven representative widths
(plus both Clerk setup checks). Allow several minutes for the authenticated suite;
the interaction run took about five minutes on the shared local development stack.
Phone calendar screenshots in both themes and the phone Admin screenshot were
visually inspected.

The long-name fixture reproduced 206px of horizontal overflow at 320px before the
tool-card wrapping fix. All 72 affected component tests passed; the final focused
rerun of 27 board, borrowing and calendar tests also passed. Type checking, lint
for changed code, and whitespace checks passed.

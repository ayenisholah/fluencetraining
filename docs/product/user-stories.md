# User stories

Stories are grouped by epic. Each has acceptance criteria in Given / When / Then form, a MoSCoW priority (**M**ust, **S**hould, **C**ould), the brief requirement it traces to in [REQUIREMENTS.md](../REQUIREMENTS.md) (P = public, A = authenticated, R = roles, N/S = n8n, B = bonus), and the tests that check it.

Personas are described in [vision.md](vision.md).

---

## Epic 1: Public board

### US-1.1 See what's available before signing up · M · P1–P4
**As a** visitor **I want** to see which tools are available, by name and category, **so that** I know whether LendLoop is worth joining.

- **Given** I'm signed out, **when** I open `/`, **then** I see the LendLoop name, the tagline and an "Available now" list.
- **Given** tools exist, **then** each shows only its name and a coloured category badge: no lender, condition, description or photo.
- **Given** a tool is on loan or removed, **then** it isn't listed.
- **Given** there are more tools than one page holds, **then** I can move between numbered pages.

Tests: `convex/public.test.ts`, `components/screens/Home.test.tsx`, `e2e/public.spec.ts`, `e2e/signed-in.spec.ts` (landing with real data).

### US-1.2 Search the public board · S · P3
**As a** visitor **I want** to search and filter by category **so that** I can find one tool quickly.

- **When** I type in "Search available tools", **then** the list is filtered on the server by name and description.
- **When** I pick a category chip, **then** only that category is shown.
- The search and category are in the URL, so a refresh or a shared link keeps them.

Tests: `convex/public.test.ts`, `components/screens/Home.test.tsx`, `e2e/signed-in.spec.ts`.

### US-1.3 Understand how it works · S · P2
**As a** visitor **I want** a short explanation near the top **so that** I know what happens after I sign up.

- **Then** "How it works" sits directly under the hero, before the tool list, as three ordered steps: list, ask for dates, get notified.

Tests: `components/screens/Home.test.tsx`, `e2e/public.spec.ts`.

### US-1.4 Sign in from anywhere public · M · P5
**As a** visitor **I want** a clear sign-in button **so that** I can start lending or borrowing.

- **Then** the hero shows "Sign in to lend or borrow" and the header shows a brand-coloured "Sign in"; both open Clerk's sign-in.
- **When** I finish signing in, **then** I land on `/tools`.
- **Given** I was sent to sign in from a protected page, **then** I return to that page instead.

Tests: `components/screens/Home.test.tsx`, `e2e/public.spec.ts`, `e2e/sign-in.spec.ts`.

---

## Epic 2: Listing tools

### US-2.1 List a tool · M · A1
**As a** lender **I want** to list a tool with a name, category, condition and short description **so that** neighbours can ask to borrow it.

- **Given** I'm signed in, **when** I submit the "List a tool" form with valid fields, **then** the tool appears on the board as Available, owned by me.
- Name is 2–80 characters; description is at most 500. Control characters and bidi overrides are refused, on the server too.
- **Validation errors appear only after I try to submit**, then update live as I fix the field. Typing into or leaving a field never shows an error by itself.

Tests: `convex/workflow.test.ts`, `convex/rules.test.ts`, `components/ToolForm.test.tsx`, `e2e/signed-in.spec.ts`.

### US-2.2 Add a photo · S · A1
**As a** lender **I want** to add a photo **so that** borrowers can see the tool's condition.

- **When** I choose or drop a JPEG, PNG or WebP of up to 5 MB, **then** I see a preview and can Replace or Remove it before saving.
- **When** I choose another type (including SVG) or a bigger file, **then** I see an error and nothing is uploaded.
- **Then** the photo shows on the board (cards, tiles and list), My listings and Admin. The public page never shows photos.
- Replacing or removing a photo, or deleting the listing, deletes the old file. Uploads abandoned for a day are cleaned up.

Tests: `convex/images.test.ts`, `components/CategoryBadge.test.tsx` (PhotoPicker), `components/screens/Listings.test.tsx`, `e2e/signed-in.spec.ts`.

### US-2.3 Edit and delete my listings · M · R4
**As a** lender **I want** to edit or delete only my own listings.

- **Then** Edit and Delete appear only on My listings, for my tools.
- **When** I click Delete, **then** a dialog asks "Delete "…"?", with focus on Keep. Escape or Keep cancels and returns focus to the button.
- **When** I confirm, **then** the listing disappears everywhere and its open requests are declined.
- **Given** the tool is on loan, **then** the dialog shows the server's refusal and stays open.
- **Given** I'm anyone but the owner, **then** the server refuses edits and deletes, whatever the UI shows.

Tests: `convex/access.test.ts`, `components/screens/Listings.test.tsx`, `components/ui/ConfirmDialog/ConfirmDialog.test.tsx`, `e2e/signed-in.spec.ts`.

### US-2.4 Find my own listings · S · A6
- My listings has a search box and All / Available / On loan filter, paginated on the server.

Tests: `convex/search.test.ts`, `components/screens/Listings.test.tsx`.

---

## Epic 3: Borrowing

### US-3.1 Browse the board · M · A5
**As a** borrower **I want** to see every listed tool with its availability **so that** I can choose what to ask for.

- **Then** each tool shows its photo (or a category-coloured tile), name, category, condition, availability, the lender's first name and a Trusted badge if earned.
- **When** I pick a category chip, toggle "Available only" or search, **then** the board is filtered on the server, and the choice is kept in the URL.
- **When** I switch the view between **Cards**, **Tiles** and **List**, **then** the layout changes and the view is kept in the URL.
- **Given** nothing matches, **then** I see "No tools match …" and a Clear filters button.

Tests: `convex/search.test.ts`, `components/screens/Tools.test.tsx`, `e2e/signed-in.spec.ts`.

### US-3.2 Ask to borrow for dates · M · A2
**As a** borrower **I want** to request a tool for a date range.

- **When** I pick From and Until on the calendar and send, **then** I see "Request sent" and the lender is emailed.
- I can't request my own tool, a range longer than 30 days, a range in the past, dates overlapping an active loan, or a second open request for the same tool.

Tests: `convex/workflow.test.ts`, `components/BorrowForm.test.tsx`, `e2e/signed-in.spec.ts`, `e2e/automation.spec.ts`.

### US-3.3 Track my requests · M · A6
- My requests lists my loans with their status (Requested, On loan, Overdue, Declined, Cancelled, Returned) and the lender's first name.
- I can search by tool name and switch between All / Open / On loan / Closed.
- **When** I cancel an open request, **then** a dialog asks first.

Tests: `convex/search.test.ts`, `components/LoanList.test.tsx`, `e2e/signed-in.spec.ts`.

---

## Epic 4: Lending

### US-4.1 Decide on requests · M · A3, R5
**As a** lender **I want** to approve or decline requests for my tools.

- Incoming lists requests for my tools, searchable and tabbed like My requests, with a badge in the sidebar for open ones.
- **When** I approve, **then** the tool goes On loan and the borrower is emailed.
- **When** I decline, **then** a dialog asks "Decline …'s request?" first; the borrower is emailed.
- Requests whose dates have passed can't be approved. Only the lender can act; the server refuses everyone else.

Tests: `convex/workflow.test.ts`, `convex/access.test.ts`, `components/LoanList.test.tsx`, `e2e/signed-in.spec.ts`.

### US-4.2 Mark a loan returned · M · A4
- **When** I mark an active loan returned, **then** the tool is available again and the borrower is emailed.

Tests: `convex/workflow.test.ts`, `e2e/signed-in.spec.ts`.

---

## Epic 5: Roles and moderation

### US-5.1 Remove any listing · M · R1
**As an** admin **I want** to remove any listing **so that** inappropriate or abandoned ones go away.

- Admin › Listings is searchable, filterable by category and paginated, with thumbnails.
- **When** I remove a listing, **then** a dialog confirms first. On a tool that's on loan, it explains that the loan stays open for the lender to close.

Tests: `convex/access.test.ts`, `components/screens/Admin.test.tsx`, `e2e/admin.spec.ts`.

### US-5.2 See all loans · M · R2
- Admin › All loans shows every loan with both parties' names, searchable by tool and filterable by phase, paginated.

### US-5.3 Mark a Trusted Lender · M · R3
- Admin › Members is searchable by name or email, filterable to Trusted or Admins; each member has a named Trusted switch. Trusted lenders get a badge on their listings.

### US-5.4 Admin only, enforced on the server · M · R6
- Non-admins see "Admins only" and no admin data is requested; every admin function refuses non-admins on the server.
- Roles can't be changed from the app; an operator promotes admins from the CLI.

Tests: `convex/access.test.ts` (coverage guard + deny matrix), `components/screens/Admin.test.tsx`, `e2e/admin.spec.ts`.

---

## Epic 6: Notifications and reminders (n8n)

### US-6.1 Be told when something changes · M · N1, N2
- Requested and cancelled emails go to the lender; approved, declined and returned emails go to the borrower.
- Emails contain only the recipient's first name, the other party's first name, the tool and the dates.

Tests: `convex/automation.test.ts`, `n8n/workflows.test.ts`, `n8n/roundtrip.test.ts`, `e2e/automation.spec.ts`.

### US-6.2 Get reminded when overdue · M · N3, N4
- Once a day, every borrower with an overdue loan gets one reminder; re-runs the same day send nothing new. The reminder is recorded on the loan.

### US-6.3 See recent automation activity · C · B1
- Each loan card shows the latest activity, e.g. "Reminder sent 2 days ago".

### US-6.4 Know when automation fails · M · S4
**As an** operator **I want** failures to be visible.

- Failed webhook deliveries retry with backoff, then show in Admin › Automation health with Retry.
- A failing n8n run triggers the error workflow, which emails ops and records an error shown in Admin.

Tests: `convex/automation.test.ts`, `n8n/workflows.test.ts`, `e2e/automation.spec.ts`.

---

## Epic 7: Accessibility and quality

### US-7.1 Usable with keyboard and screen reader · M
- Every screen passes axe (WCAG 2.1 AA) in both themes; dialogs trap focus and restore it; chips and view switchers are radiogroups with arrow keys.

### US-7.2 Readable in light and dark · M
- All colour pairs, including the seven category presets, meet AA contrast (`npm run check:contrast`).

### US-7.3 Works on a phone · M
- No horizontal scroll at phone width; the board, chips and view switcher adapt.

Tests: `test/axe.ts` users across the UI suite, Storybook story tests, `e2e/public.spec.ts`, `e2e/signed-in.spec.ts`.

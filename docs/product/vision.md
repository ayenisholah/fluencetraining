# Product vision

## Problem

Most households own tools they use a few times a year: a drill, a ladder, a tent, a pressure washer. Neighbours who need one for a weekend either buy their own or don't do the job. Lending happens informally (a message to a friend), which doesn't scale beyond people you already know, and nobody remembers who has what or when it's due back.

## Vision

**LendLoop is a neighbourhood board where people list the tools they're willing to lend, ask to borrow each other's, and get reminded automatically, so lending is as easy as asking a friend and nothing goes missing.**

Tagline: *Borrow what you need. Lend what you don't.*

## People

| Persona | Who | What they need |
|---|---|---|
| **Visitor** | Anyone, signed out | See what's available nearby before committing to an account |
| **Lender** (Priya) | Owns tools, happy to share, busy | List a tool in a minute; decide who borrows; get it back on time without chasing |
| **Borrower** (Tom) | Needs a tool for a few days | Find it, ask for dates, know where the request stands, be reminded before it's awkward |
| **Admin** (moderator) | Trusted community member | Remove inappropriate listings, see all loans, mark reliable lenders as Trusted |
| **Operator** | Runs the service | Know when automation fails; fix it without touching data by hand |

A real person is often both a lender and a borrower; the roles in the app are just `user` and `admin`.

## Goals

1. **Listing is quick:** a tool with name, category, condition, description and an optional photo in under a minute.
2. **Borrowing is clear:** every request has one visible state (open, on loan, closed) on both sides.
3. **Nothing is forgotten:** every state change notifies the right person; overdue loans get a daily reminder, and the reminder is recorded on the loan.
4. **Trust is earned and visible:** admins can mark Trusted Lenders; misuse can be moderated.
5. **Private by default:** neighbours see a first name, never an email; the public page shows only tool name and category.

## Non-goals (for this version)

- Payments, deposits or insurance.
- Messaging between neighbours (email notifications only).
- Locations and maps; LendLoop assumes one neighbourhood.
- Native mobile apps (the web app is responsive).
- Handover confirmation by both parties; the lender marks a loan returned.

## Success measures

| Measure | Target | How it's measured |
|---|---|---|
| Time to list a tool | < 1 min | Usability test of the listing form |
| Requests that get a decision | > 90 % within 3 days | `loans` with `decidedAt` vs `_creationTime` |
| Overdue loans reminded | 100 % daily | `automationEvents` of kind `overdue_reminder` per overdue loan |
| Failed automations visible | 100 % | Every failed delivery or workflow error shows in Admin › Automation health |
| Accessibility | WCAG 2.1 AA | axe in unit, Storybook and Playwright suites; contrast check in CI |

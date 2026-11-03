# 0002. Clerk for identity; roles and all authorisation in Convex

**Context.** The brief requires role-based access control enforced in Convex, not only in the UI. Clerk could hold roles in metadata or Organizations.

**Decision.** Clerk only proves who the user is (the JWT's `tokenIdentifier`). Roles (`user`, `admin`) and the Trusted flag live in the Convex `users` table. Every public function calls a guard from `convex/lib/auth.ts` (`requireUser`, `requireToolOwner`, `requireLoanParty`, `requireAdmin`). New users are always `user`; admins are promoted by an operator through an internal mutation.

**Consequences.** One place to audit. A coverage guard test lists every public function with its guard, so a new unguarded function fails CI. The UI hides what the server would refuse, but never relies on that. Promoting admins needs the CLI until an audited admin UI exists (README production notes).

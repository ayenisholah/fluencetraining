# 0006. Soft-delete listings

**Context.** Loans reference tools. Deleting a tool would leave loan history pointing nowhere, and admins may remove a listing that is on loan.

**Decision.** Removing a listing sets `status: "removed"` (and `removedBy`), declines its open requests, deletes its photo, and hides it from every list (`listed: false`). Owners can't remove a tool that's on loan; admins can, and the loan stays open so the lender can still mark it returned.

**Consequences.** History stays readable. Lists must filter on `listed`. Test data is the exception: `dev:purgeTestData` hard-deletes `E2E …` rows.

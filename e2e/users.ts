// Clerk test users. "+clerk_test" addresses never receive real email and
// accept the code 424242 on development instances.
export const LENDER = { email: "lendloop-lender+clerk_test@example.com", firstName: "Lena", lastName: "Lender" };
export const BORROWER = { email: "lendloop-borrower+clerk_test@example.com", firstName: "Bora", lastName: "Borrower" };
// Admin spec: its own lender and borrower so per-user hourly limits and
// parallel runs never interfere with signed-in.spec.ts. ADMIN is promoted with
// `convex run users:setRole` on first use (roles are never set by the client).
export const ADMIN = { email: "lendloop-admin+clerk_test@example.com", firstName: "Ada", lastName: "Admin" };
export const OWNER = { email: "lendloop-owner+clerk_test@example.com", firstName: "Olu", lastName: "Owner" };
export const RENTER = { email: "lendloop-renter+clerk_test@example.com", firstName: "Remi", lastName: "Renter" };

// Dedicated accounts keep concurrency browser fixtures independent of other suites.
export const RACE_OWNER = { email: "lendloop-race-owner+clerk_test@example.com", firstName: "RaceOwner", lastName: "Test" };
export const RACE_A = { email: "lendloop-race-a+clerk_test@example.com", firstName: "RaceA", lastName: "Test" };
export const RACE_B = { email: "lendloop-race-b+clerk_test@example.com", firstName: "RaceB", lastName: "Test" };

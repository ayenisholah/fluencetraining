import { createClerkClient } from "@clerk/backend";
import { clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";
import { BORROWER, LENDER } from "./users";

setup.describe.configure({ mode: "serial" });

setup("configure Clerk testing token", async () => {
  await clerkSetup({ publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY });
});

setup("ensure test users exist", async () => {
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  for (const user of [LENDER, BORROWER]) {
    const { data } = await clerk.users.getUserList({ emailAddress: [user.email] });
    if (data.length === 0) {
      await clerk.users.createUser({
        emailAddress: [user.email],
        firstName: user.firstName,
        lastName: user.lastName,
        skipPasswordRequirement: true,
      });
    }
  }
});

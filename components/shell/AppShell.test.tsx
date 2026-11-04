import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { axeViolations } from "@/test/axe";
import { queryResults, resetConvexMock } from "@/test/convex-mock";
import { AppShell } from "./AppShell";

vi.mock("convex/react", async () => (await import("@/test/convex-mock")).convexReactMock);
vi.mock("@clerk/nextjs", () => ({ UserButton: () => <span>account</span> }));

const page = <p>Tools page</p>;

describe("AppShell while the user record loads", () => {
  beforeEach(() => resetConvexMock());

  test("a returning user sees a page-shaped skeleton, not 'Setting up your account'", async () => {
    // users:me not answered yet (undefined): the usual brief load.
    const { container } = render(<AppShell>{page}</AppShell>);
    expect(screen.queryByText("Tools page")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(screen.queryByText(/Setting up your account/)).not.toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(await axeViolations(container)).toEqual([]);
  });

  test("a first sign-in (no user row yet) says the account is being set up", () => {
    queryResults["users:me"] = null;
    render(<AppShell>{page}</AppShell>);
    expect(screen.getByRole("status")).toHaveTextContent("Setting up your account…");
    expect(screen.queryByText("Tools page")).not.toBeInTheDocument();
  });

  test("renders the page once the user record exists", () => {
    queryResults["users:me"] = { _id: "u1", name: "Ada", role: "user", trustedLender: false };
    queryResults["loans:pendingIncomingCount"] = 0;
    render(<AppShell>{page}</AppShell>);
    expect(screen.getByText("Tools page")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

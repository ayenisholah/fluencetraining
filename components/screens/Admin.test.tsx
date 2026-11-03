import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { axeViolations } from "@/test/axe";
import { loadMore, mutations, paginated, queryArgs, queryResults, resetConvexMock } from "@/test/convex-mock";
import { AdminScreen, LOANS_PAGE_SIZE } from "./Admin";

vi.mock("convex/react", async () => (await import("@/test/convex-mock")).convexReactMock);

const loan = (id: string, toolName: string, status: string, overdue = false) => ({
  _id: id,
  toolName,
  toolCategory: "hand_tools",
  startDate: "2026-11-04",
  endDate: "2026-11-06",
  status,
  overdue,
  counterpartName: "x",
  lenderName: "Olu Owner",
  borrowerName: "Bora Borrower",
  activity: [],
});

function signInAs(role: "admin" | "user") {
  queryResults["users:me"] = { _id: "me", name: "Me", role, trustedLender: false };
}

function seedAdminData() {
  queryResults["admin:stats"] = { openRequests: 2, activeLoans: 1, overdueLoans: 1, failedDeliveries: 0 };
  queryResults["admin:automationHealth"] = { deliveries: [], workflowErrors: [] };
  queryResults["admin:listings"] = [
    { _id: "t1", name: "Ladder", category: "hand_tools", status: "available", ownerName: "Olu Owner" },
    { _id: "t2", name: "Tent", category: "camping", status: "on_loan", ownerName: "Ada" },
  ];
  queryResults["admin:users"] = [
    { _id: "u1", name: "Olu Owner", email: "olu@example.com", role: "user", trustedLender: false },
    { _id: "u2", name: "Root", email: "root@example.com", role: "admin", trustedLender: true },
  ];
  paginated["admin:allLoans"] = {
    results: [loan("l1", "Ladder", "requested"), loan("l2", "Tent", "approved", true)],
    status: "CanLoadMore",
  };
}

const section = (name: string) => screen.getByRole("heading", { name }).closest("section") as HTMLElement;
const row = (container: HTMLElement, text: string) =>
  within(container).getByText(text, { exact: true }).closest("li") as HTMLElement;

beforeEach(() => {
  resetConvexMock();
  seedAdminData();
});

describe("AdminScreen access", () => {
  test("a regular user sees 'Admins only' and no admin query is even subscribed", () => {
    signInAs("user");
    render(<AdminScreen />);
    expect(screen.getByText("Admins only")).toBeInTheDocument();
    expect(Object.keys(queryArgs).filter((name) => name.startsWith("admin:"))).toEqual([]);
  });

  test("signed out (me is null) is treated the same", () => {
    queryResults["users:me"] = null;
    render(<AdminScreen />);
    expect(screen.getByText("Admins only")).toBeInTheDocument();
  });

  test("waits for the role before deciding", () => {
    render(<AdminScreen />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Admins only")).toBeNull();
  });
});

describe("AdminScreen for an admin", () => {
  beforeEach(() => signInAs("admin"));

  test("shows headline stats", () => {
    render(<AdminScreen />);
    expect(screen.getByRole("heading", { level: 1, name: "Admin" })).toBeInTheDocument();
    expect(screen.getByText("Open requests").closest("div")?.parentElement).toHaveTextContent("2");
  });

  test("lists all loans with both parties and status, and pages through them", async () => {
    render(<AdminScreen />);
    const loans = section("All loans");
    expect(within(loans).getAllByText(/Olu Owner → Bora Borrower/)).toHaveLength(2);
    expect(within(row(loans, "Ladder")).getByText("Requested")).toBeInTheDocument();
    expect(within(row(loans, "Tent")).getByText("Overdue")).toBeInTheDocument();
    expect(queryArgs["admin:allLoans"].at(-1)).toEqual({});
    await userEvent.click(within(loans).getByRole("button", { name: "Load more loans" }));
    expect(loadMore).toHaveBeenCalledWith(LOANS_PAGE_SIZE);
  });

  test("no Load more once every loan is shown", () => {
    paginated["admin:allLoans"].status = "Exhausted";
    render(<AdminScreen />);
    expect(screen.queryByRole("button", { name: "Load more loans" })).toBeNull();
  });

  test("marks a member as a trusted lender, and unmarks", async () => {
    render(<AdminScreen />);
    const olu = screen.getByRole("switch", { name: "Olu Owner: Trusted" });
    expect(olu).toHaveAttribute("aria-checked", "false");
    await userEvent.click(olu);
    expect(mutations["admin:setTrustedLender"]).toHaveBeenCalledWith({ userId: "u1", trusted: true });
    await userEvent.click(screen.getByRole("switch", { name: "Root: Trusted" }));
    expect(mutations["admin:setTrustedLender"]).toHaveBeenLastCalledWith({ userId: "u2", trusted: false });
  });

  test("removing any listing asks first; Keep backs out", async () => {
    render(<AdminScreen />);
    await userEvent.click(screen.getByRole("button", { name: "Remove Ladder" }));
    const confirm = screen.getByRole("group", { name: "Remove Ladder?" });
    expect(confirm).toHaveTextContent("Open requests will be declined.");
    await userEvent.click(within(confirm).getByRole("button", { name: "Keep" }));
    expect(mutations["admin:removeListing"]).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Remove Ladder" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm remove" }));
    expect(mutations["admin:removeListing"]).toHaveBeenCalledWith({ toolId: "t1" });
  });

  test("an on-loan listing can be removed too, with a note that the loan stays open", async () => {
    render(<AdminScreen />);
    const remove = screen.getByRole("button", { name: "Remove Tent" });
    expect(remove).toBeEnabled();
    await userEvent.click(remove);
    expect(screen.getByRole("group", { name: "Remove Tent?" })).toHaveTextContent("the loan stays open");
    await userEvent.click(screen.getByRole("button", { name: "Confirm remove" }));
    expect(mutations["admin:removeListing"]).toHaveBeenCalledWith({ toolId: "t2" });
  });

  test("a refused action is shown on its row instead of failing silently", async () => {
    render(<AdminScreen />);
    // Create the stubs, then make them fail.
    await userEvent.click(screen.getByRole("switch", { name: "Olu Owner: Trusted" }));
    mutations["admin:setTrustedLender"].mockRejectedValueOnce(new ConvexError({ code: "FORBIDDEN", message: "Admins only." }));
    await userEvent.click(screen.getByRole("switch", { name: "Olu Owner: Trusted" }));
    const members = section("Members");
    expect(await within(row(members, "olu@example.com")).findByText("Admins only.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Remove Ladder" }));
    mutations["admin:removeListing"].mockRejectedValueOnce(new ConvexError({ code: "NOT_FOUND", message: "Tool not found." }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm remove" }));
    expect(await screen.findByText("Tool not found.")).toBeInTheDocument();
    // Starting another action clears the old message.
    expect(screen.queryByText("Admins only.")).toBeNull();
  });

  test("has no axe violations", async () => {
    const { container } = render(<AdminScreen />);
    expect(await axeViolations(container)).toEqual([]);
  });
});

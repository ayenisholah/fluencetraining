import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { axeViolations } from "@/test/axe";
import { mutations, paginated, queryArgs, queryResults, resetConvexMock } from "@/test/convex-mock";
import { AdminScreen } from "./Admin";

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
  paginated["admin:listings"] = {
    results: [
      {
        _id: "t1",
        name: "Ladder",
        category: "hand_tools",
        status: "available",
        imageUrl: null,
        ownerName: "Olu Owner",
      },
      { _id: "t2", name: "Tent", category: "camping", status: "on_loan", imageUrl: null, ownerName: "Ada" },
    ],
    status: "Exhausted",
  };
  paginated["admin:users"] = {
    results: [
      { _id: "u1", name: "Olu Owner", email: "olu@example.com", role: "user", trustedLender: false },
      { _id: "u2", name: "Root", email: "root@example.com", role: "admin", trustedLender: true },
    ],
    status: "Exhausted",
  };
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
    expect(queryArgs["admin:allLoans"].at(-1)).toMatchObject({ search: undefined, phase: undefined });
    await userEvent.click(within(loans).getByRole("button", { name: "Next" }));
    expect(queryArgs["admin:allLoans"].at(-1)).toMatchObject({ pageNumber: 2, pageSize: 10 });
    expect(queryArgs["admin:users"].at(-1)).toMatchObject({ pageNumber: 1, pageSize: 10 });
  });

  test("Next is disabled on the last loan page", () => {
    paginated["admin:allLoans"].status = "Exhausted";
    render(<AdminScreen />);
    expect(within(section("All loans")).getByRole("button", { name: "Next" })).toBeDisabled();
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

  test("removing any listing asks in a dialog; Keep backs out", async () => {
    render(<AdminScreen />);
    await userEvent.click(screen.getByRole("button", { name: "Remove Ladder" }));
    const dialog = screen.getByRole("alertdialog", { name: 'Remove "Ladder"?' });
    expect(dialog).toHaveAccessibleDescription(/open requests for it are declined/);
    await userEvent.click(within(dialog).getByRole("button", { name: "Keep" }));
    expect(mutations["admin:removeListing"]).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Remove Ladder" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove listing" }));
    expect(mutations["admin:removeListing"]).toHaveBeenCalledWith({ toolId: "t1" });
  });

  test("an on-loan listing can be removed too, with a note that the loan stays open", async () => {
    render(<AdminScreen />);
    await userEvent.click(screen.getByRole("button", { name: "Remove Tent" }));
    expect(screen.getByRole("alertdialog", { name: 'Remove "Tent"?' })).toHaveAccessibleDescription(/loan stays open/);
    await userEvent.click(screen.getByRole("button", { name: "Remove listing" }));
    expect(mutations["admin:removeListing"]).toHaveBeenCalledWith({ toolId: "t2" });
  });

  test("a refused action is shown where it happened instead of failing silently", async () => {
    render(<AdminScreen />);
    await userEvent.click(screen.getByRole("switch", { name: "Olu Owner: Trusted" }));
    mutations["admin:setTrustedLender"].mockRejectedValueOnce(
      new ConvexError({ code: "FORBIDDEN", message: "Admins only." }),
    );
    await userEvent.click(screen.getByRole("switch", { name: "Olu Owner: Trusted" }));
    const members = section("Members");
    expect(await within(row(members, "olu@example.com")).findByText("Admins only.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Remove Ladder" }));
    mutations["admin:removeListing"].mockRejectedValueOnce(
      new ConvexError({ code: "NOT_FOUND", message: "Tool not found." }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Remove listing" }));
    expect(await within(screen.getByRole("alertdialog")).findByText("Tool not found.")).toBeInTheDocument();
  });

  test("each section searches on the server", async () => {
    render(<AdminScreen />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Search members by name or email" }), "olu");
    await vi.waitFor(() => expect(queryArgs["admin:users"].at(-1)).toMatchObject({ search: "olu" }));
    await userEvent.click(screen.getByRole("radio", { name: "Trusted" }));
    expect(queryArgs["admin:users"].at(-1)).toMatchObject({ search: "olu", filter: "trusted" });
    await userEvent.type(screen.getByRole("searchbox", { name: "Search loans by tool name" }), "tent");
    await vi.waitFor(() => expect(queryArgs["admin:allLoans"].at(-1)).toMatchObject({ search: "tent" }));
    await userEvent.type(screen.getByRole("searchbox", { name: "Search listings" }), "lad");
    await vi.waitFor(() => expect(queryArgs["admin:listings"].at(-1)).toMatchObject({ search: "lad" }));
  });

  test("has no axe violations", async () => {
    const { container } = render(<AdminScreen />);
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe("bulk listing removal", () => {
  beforeEach(() => signInAs("admin"));

  test("selects rows, supports mixed/select-all state, confirms and reports results", async () => {
    render(<AdminScreen />);
    const listings = within(section("Listings"));
    expect(listings.getByRole("button", { name: "Remove selected (0)" })).toBeDisabled();
    await userEvent.click(listings.getByRole("checkbox", { name: "Select Ladder" }));
    expect(listings.getByRole("checkbox", { name: "Select all on this page" })).toBePartiallyChecked();
    await userEvent.click(listings.getByRole("checkbox", { name: "Select all on this page" }));
    expect(listings.getByRole("checkbox", { name: "Select Tent" })).toBeChecked();
    await userEvent.click(listings.getByRole("button", { name: "Remove selected (2)" }));
    const dialog = screen.getByRole("alertdialog", { name: "Remove 2 listings?" });
    expect(dialog).toHaveAccessibleDescription(/Active loans stay open/);
    await userEvent.click(within(dialog).getByRole("button", { name: "Keep" }));
    expect(mutations["admin:removeListings"]).not.toHaveBeenCalled();
    await userEvent.click(listings.getByRole("button", { name: "Remove selected (2)" }));
    mutations["admin:removeListings"].mockResolvedValueOnce({ removedCount: 1, skippedCount: 1 });
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove selected" }));
    expect(mutations["admin:removeListings"]).toHaveBeenCalledWith({ toolIds: ["t1", "t2"] });
    expect(listings.getByRole("status")).toHaveTextContent("1 listing removed. 1 already removed or unavailable.");
    expect(listings.getByRole("button", { name: "Remove selected (0)" })).toBeDisabled();
    await vi.waitFor(() => expect(listings.getByRole("group", { name: "Listing selection" })).toHaveFocus());
  });

  test("failures retain selection and allow retry", async () => {
    render(<AdminScreen />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Ladder" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove selected (1)" }));
    mutations["admin:removeListings"].mockRejectedValueOnce(
      new ConvexError({ code: "BAD_REQUEST", message: "Try again" }),
    );
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Remove selected" }));
    expect(await screen.findByText("Try again")).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "Select Ladder" })).toBeChecked();
    mutations["admin:removeListings"].mockResolvedValueOnce({ removedCount: 1, skippedCount: 0 });
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Remove selected" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  test("selection clears on navigation, page size, raw search, and category changes", async () => {
    paginated["admin:listings"].status = "CanLoadMore";
    render(<AdminScreen />);
    const listings = within(section("Listings"));
    const select = () => userEvent.click(listings.getByRole("checkbox", { name: "Select Ladder" }));
    await select();
    await userEvent.click(listings.getByRole("button", { name: "Next" }));
    expect(listings.getByRole("checkbox", { name: "Select Ladder" })).not.toBeChecked();
    await select();
    await userEvent.click(listings.getByRole("combobox", { name: "Items per page" }));
    await userEvent.click(listings.getByRole("option", { name: "25" }));
    expect(listings.getByRole("checkbox", { name: "Select Ladder" })).not.toBeChecked();
    await select();
    await userEvent.type(listings.getByRole("searchbox"), "l");
    expect(listings.getByRole("checkbox", { name: "Select Ladder" })).not.toBeChecked();
    await select();
    await userEvent.click(listings.getByRole("combobox", { name: "Category" }));
    await userEvent.click(listings.getByRole("option", { name: "Garden" }));
    expect(listings.getByRole("checkbox", { name: "Select Ladder" })).not.toBeChecked();
    await select();
    await userEvent.click(listings.getByRole("button", { name: "Clear selection" }));
    expect(listings.getByRole("checkbox", { name: "Select Ladder" })).not.toBeChecked();
  });

  test("live removals prune selection", async () => {
    const { rerender } = render(<AdminScreen />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Select all on this page" }));
    paginated["admin:listings"].results = paginated["admin:listings"].results.slice(1);
    rerender(<AdminScreen />);
    expect(screen.getByRole("button", { name: "Remove selected (1)" })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: "Select all on this page" })).toBeChecked();
  });
});

test("bulk confirmation snapshots IDs and prevents repeat submission while pending", async () => {
  signInAs("admin");
  const { rerender } = render(<AdminScreen />);
  await userEvent.click(screen.getByRole("checkbox", { name: "Select all on this page" }));
  await userEvent.click(screen.getByRole("button", { name: "Remove selected (2)" }));
  paginated["admin:listings"].results = paginated["admin:listings"].results.slice(1);
  rerender(<AdminScreen />);
  let resolve!: (value: { removedCount: number; skippedCount: number }) => void;
  mutations["admin:removeListings"].mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const dialog = within(screen.getByRole("alertdialog"));
  const submit = dialog.getByRole("button", { name: "Remove selected" });
  await userEvent.click(submit);
  expect(submit).toBeDisabled();
  expect(dialog.getByRole("button", { name: "Keep" })).toBeDisabled();
  await userEvent.click(submit);
  expect(mutations["admin:removeListings"]).toHaveBeenCalledTimes(1);
  expect(mutations["admin:removeListings"]).toHaveBeenCalledWith({ toolIds: ["t1", "t2"] });
  await act(async () => resolve({ removedCount: 1, skippedCount: 1 }));
});

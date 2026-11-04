import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { axeViolations } from "@/test/axe";
import { mutations, paginated, queryArgs, resetConvexMock } from "@/test/convex-mock";
import { ListingsScreen } from "./Listings";

vi.mock("convex/react", async () => (await import("@/test/convex-mock")).convexReactMock);

const mine = [
  {
    _id: "t1",
    name: "Ladder",
    category: "hand_tools",
    condition: "good",
    description: "Three metres.",
    status: "available",
    imageUrl: "https://convex.example/1",
  },
  {
    _id: "t2",
    name: "Tent",
    category: "camping",
    condition: "fair",
    description: "",
    status: "on_loan",
    imageUrl: null,
  },
];

const row = (name: string) => screen.getByRole("heading", { name }).closest("li") as HTMLElement;

beforeEach(() => {
  resetConvexMock();
  paginated["tools:mine"] = { results: mine, status: "Exhausted" };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ storageId: "storage1" }))),
  );
  mutations["tools:generateUploadUrl"] = vi.fn().mockResolvedValue("https://convex.example/upload");
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => vi.unstubAllGlobals());

describe("ListingsScreen", () => {
  test("lists my tools with photo, status, category badge and condition", () => {
    render(<ListingsScreen />);
    expect(within(row("Ladder")).getByRole("img", { name: "Ladder" })).toBeInTheDocument();
    expect(within(row("Ladder")).getByText("Available")).toBeInTheDocument();
    expect(within(row("Ladder")).getByText("Hand tools").className).toContain("bg-preset-blue-soft");
    expect(within(row("Tent")).getByText("On loan")).toBeInTheDocument();
  });

  test("search and status filter go to the server", async () => {
    render(<ListingsScreen />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Search your listings" }), "lad");
    await vi.waitFor(() => expect(queryArgs["tools:mine"].at(-1)).toMatchObject({ search: "lad" }));
    await userEvent.click(screen.getByRole("radio", { name: "On loan" }));
    expect(queryArgs["tools:mine"].at(-1)).toMatchObject({ search: "lad", status: "on_loan" });
  });

  test("a new listing with a photo uploads it first, then creates the tool with its id", async () => {
    render(<ListingsScreen />);
    const form = screen.getByRole("region", { name: "List a tool" });
    await userEvent.type(within(form).getByLabelText("Name"), "Hedge trimmer");
    const file = new File([new Uint8Array(10)], "trimmer.png", { type: "image/png" });
    await userEvent.upload(within(form).getByLabelText("Choose a photo"), file);
    expect(within(form).getByRole("img", { name: "Selected photo" })).toHaveAttribute("src", "blob:preview");
    await userEvent.click(within(form).getByRole("button", { name: "List it" }));
    expect(fetch).toHaveBeenCalledWith(
      "https://convex.example/upload",
      expect.objectContaining({ method: "POST", body: file }),
    );
    expect(mutations["tools:create"]).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Hedge trimmer", imageId: "storage1" }),
    );
  });

  test("editing can remove the current photo", async () => {
    render(<ListingsScreen />);
    await userEvent.click(within(row("Ladder")).getByRole("button", { name: "Edit" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(mutations["tools:update"]).toHaveBeenCalledWith(
      expect.objectContaining({ toolId: "t1", removeImage: true }),
    );
  });

  test("delete asks in a dialog; Keep backs out, Delete listing removes", async () => {
    render(<ListingsScreen />);
    const trigger = within(row("Ladder")).getByRole("button", { name: "Delete" });
    await userEvent.click(trigger);
    const dialog = screen.getByRole("alertdialog", { name: 'Delete "Ladder"?' });
    expect(dialog).toHaveAccessibleDescription(/open requests for it are declined/);
    expect(within(dialog).getByRole("button", { name: "Keep" })).toHaveFocus();
    await userEvent.click(within(dialog).getByRole("button", { name: "Keep" }));
    expect(mutations["tools:remove"]).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();

    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole("button", { name: "Delete listing" }));
    expect(mutations["tools:remove"]).toHaveBeenCalledWith({ toolId: "t1" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  test("a server refusal stays in the dialog", async () => {
    render(<ListingsScreen />);
    await userEvent.click(within(row("Tent")).getByRole("button", { name: "Delete" }));
    mutations["tools:remove"].mockRejectedValueOnce(
      new ConvexError({ code: "BAD_REQUEST", message: "This tool is on loan. Mark it returned first." }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Delete listing" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(await within(dialog).findByText(/on loan. Mark it returned first/)).toBeInTheDocument();
  });

  test("empty state", () => {
    paginated["tools:mine"] = { results: [], status: "Exhausted" };
    render(<ListingsScreen />);
    expect(screen.getByText("You haven't listed anything yet")).toBeInTheDocument();
  });

  test("has no axe violations", async () => {
    const { container } = render(<ListingsScreen />);
    expect(await axeViolations(container)).toEqual([]);
  });
});

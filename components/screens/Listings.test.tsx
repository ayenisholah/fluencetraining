import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { axeViolations } from "@/test/axe";
import { mutations, queryResults, resetConvexMock } from "@/test/convex-mock";
import { ListingsScreen } from "./Listings";

vi.mock("convex/react", async () => (await import("@/test/convex-mock")).convexReactMock);

const mine = [
  { _id: "t1", name: "Ladder", category: "hand_tools", condition: "good", description: "Three metres.", status: "available" },
  { _id: "t2", name: "Tent", category: "camping", condition: "fair", description: "", status: "on_loan" },
];

const card = (name: string) => screen.getByRole("heading", { name }).closest("li") as HTMLElement;

beforeEach(() => {
  resetConvexMock();
  queryResults["tools:mine"] = mine;
});

describe("ListingsScreen", () => {
  test("lists my tools with status, category and condition", () => {
    render(<ListingsScreen />);
    expect(within(card("Ladder")).getByText("Available")).toBeInTheDocument();
    expect(within(card("Ladder")).getByText("Hand tools · Good")).toBeInTheDocument();
    expect(within(card("Tent")).getByText("On loan")).toBeInTheDocument();
  });

  test("the new-listing form creates a tool with all four fields", async () => {
    render(<ListingsScreen />);
    const form = screen.getByRole("region", { name: "List a tool" });
    await userEvent.type(within(form).getByLabelText("Name"), "Hedge trimmer");
    await userEvent.click(within(form).getByRole("combobox", { name: /Category/ }));
    await userEvent.click(screen.getByRole("option", { name: "Garden" }));
    await userEvent.click(within(form).getByRole("combobox", { name: /Condition/ }));
    await userEvent.click(screen.getByRole("option", { name: "Fair" }));
    await userEvent.type(within(form).getByLabelText("Short description"), "Cordless.");
    await userEvent.click(within(form).getByRole("button", { name: "List it" }));
    expect(mutations["tools:create"]).toHaveBeenCalledWith({
      name: "Hedge trimmer",
      category: "garden",
      condition: "fair",
      description: "Cordless.",
    });
  });

  test("editing saves through update", async () => {
    render(<ListingsScreen />);
    await userEvent.click(within(card("Ladder")).getByRole("button", { name: "Edit" }));
    const name = screen.getByDisplayValue("Ladder");
    await userEvent.clear(name);
    await userEvent.type(name, "Step ladder");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(mutations["tools:update"]).toHaveBeenCalledWith(
      expect.objectContaining({ toolId: "t1", name: "Step ladder", category: "hand_tools", condition: "good" }),
    );
  });

  test("delete asks for confirmation; Keep backs out", async () => {
    render(<ListingsScreen />);
    await userEvent.click(within(card("Ladder")).getByRole("button", { name: "Delete" }));
    expect(mutations["tools:remove"]).not.toHaveBeenCalled();
    const confirm = within(card("Ladder")).getByRole("group", { name: "Delete Ladder?" });
    await userEvent.click(within(confirm).getByRole("button", { name: "Keep" }));
    expect(within(card("Ladder")).getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(mutations["tools:remove"]).not.toHaveBeenCalled();

    await userEvent.click(within(card("Ladder")).getByRole("button", { name: "Delete" }));
    await userEvent.click(within(card("Ladder")).getByRole("button", { name: "Confirm delete" }));
    expect(mutations["tools:remove"]).toHaveBeenCalledWith({ toolId: "t1" });
  });

  test("a server refusal is shown on that listing", async () => {
    render(<ListingsScreen />);
    mutations["tools:remove"] = vi.fn().mockRejectedValue(
      new ConvexError({ code: "BAD_REQUEST", message: "This tool is on loan. Mark it returned first." }),
    );
    await userEvent.click(within(card("Tent")).getByRole("button", { name: "Delete" }));
    await userEvent.click(within(card("Tent")).getByRole("button", { name: "Confirm delete" }));
    expect(await within(card("Tent")).findByText(/on loan. Mark it returned first/)).toBeInTheDocument();
    expect(within(card("Tent")).getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  test("empty state", () => {
    queryResults["tools:mine"] = [];
    render(<ListingsScreen />);
    expect(screen.getByText("You haven't listed anything yet")).toBeInTheDocument();
  });

  test("has no axe violations", async () => {
    const { container } = render(<ListingsScreen />);
    expect(await axeViolations(container)).toEqual([]);
  });
});

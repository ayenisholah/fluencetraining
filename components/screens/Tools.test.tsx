import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { axeViolations } from "@/test/axe";
import { mutations, queryArgs, queryResults, resetConvexMock } from "@/test/convex-mock";
import { ToolsScreen } from "./Tools";

vi.mock("convex/react", async () => (await import("@/test/convex-mock")).convexReactMock);

const tools = [
  {
    _id: "t1",
    name: "Ladder",
    category: "hand_tools",
    condition: "good",
    description: "Three metres.",
    status: "available",
    isMine: false,
    lenderName: "Ada",
    trustedLender: true,
  },
  {
    _id: "t2",
    name: "Tent",
    category: "camping",
    condition: "fair",
    description: "",
    status: "on_loan",
    isMine: false,
    lenderName: "Bob",
    trustedLender: false,
  },
  {
    _id: "t3",
    name: "My mower",
    category: "garden",
    condition: "worn",
    description: "",
    status: "available",
    isMine: true,
    lenderName: "Me",
    trustedLender: false,
  },
];

const card = (name: string) => screen.getByRole("heading", { name }).closest("li") as HTMLElement;

beforeEach(() => {
  resetConvexMock();
  queryResults["tools:list"] = tools;
});

describe("ToolsScreen", () => {
  test("shows each tool's availability, category, condition and lender", () => {
    render(<ToolsScreen />);
    expect(within(card("Ladder")).getByText("Available")).toBeInTheDocument();
    expect(within(card("Ladder")).getByText("Trusted lender")).toBeInTheDocument();
    expect(within(card("Ladder")).getByText(/Hand tools · Good · lent by Ada/)).toBeInTheDocument();
    expect(within(card("Tent")).getByText("On loan")).toBeInTheDocument();
    expect(within(card("My mower")).getByText(/lent by you/)).toBeInTheDocument();
  });

  test("you can't request your own tool", () => {
    render(<ToolsScreen />);
    expect(within(card("Ladder")).getByRole("button", { name: "Request to borrow" })).toBeInTheDocument();
    expect(within(card("My mower")).queryByRole("button", { name: "Request to borrow" })).toBeNull();
  });

  test("the category filter re-queries with that category, and All clears it", async () => {
    render(<ToolsScreen />);
    expect(queryArgs["tools:list"].at(-1)).toEqual({});
    await userEvent.click(screen.getByRole("combobox", { name: /Category/ }));
    await userEvent.click(screen.getByRole("option", { name: "Garden" }));
    expect(queryArgs["tools:list"].at(-1)).toEqual({ category: "garden" });
    await userEvent.click(screen.getByRole("combobox", { name: /Category/ }));
    await userEvent.click(screen.getByRole("option", { name: "All categories" }));
    expect(queryArgs["tools:list"].at(-1)).toEqual({});
  });

  test("an empty category says so", async () => {
    queryResults["tools:list"] = [];
    render(<ToolsScreen />);
    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("combobox", { name: /Category/ }));
    await userEvent.click(screen.getByRole("option", { name: "Kitchen" }));
    expect(screen.getByText("Nothing here yet in this category")).toBeInTheDocument();
  });

  test("shows a spinner while loading", () => {
    queryResults["tools:list"] = undefined;
    render(<ToolsScreen />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  test("requesting sends the tool id and dates, then confirms", async () => {
    render(<ToolsScreen />);
    await userEvent.click(within(card("Ladder")).getByRole("button", { name: "Request to borrow" }));
    await userEvent.click(within(card("Ladder")).getByRole("button", { name: "Send request" }));
    expect(mutations["loans:request"]).toHaveBeenCalledWith(
      expect.objectContaining({ toolId: "t1", startDate: expect.any(String), endDate: expect.any(String) }),
    );
    expect(await within(card("Ladder")).findByText(/Request sent/)).toBeInTheDocument();
  });

  test("has no axe violations", async () => {
    const { container } = render(<ToolsScreen />);
    expect(await axeViolations(container)).toEqual([]);
  });
});

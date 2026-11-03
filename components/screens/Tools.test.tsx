import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { axeViolations } from "@/test/axe";
import { loadMore, mutations, paginated, queryArgs, resetConvexMock } from "@/test/convex-mock";
import { navigation } from "@/test/next-navigation-mock";
import { BOARD_PAGE_SIZE, ToolsScreen } from "./Tools";

vi.mock("convex/react", async () => (await import("@/test/convex-mock")).convexReactMock);

const base = { condition: "good", description: "", imageUrl: null, isMine: false, trustedLender: false };
const tools = [
  { ...base, _id: "t1", name: "Ladder", category: "hand_tools", description: "Three metres.", status: "available", lenderName: "Ada", trustedLender: true, imageUrl: "https://convex.example/img/1" },
  { ...base, _id: "t2", name: "Tent", category: "camping", condition: "fair", status: "on_loan", lenderName: "Bob" },
  { ...base, _id: "t3", name: "My mower", category: "garden", condition: "worn", status: "available", isMine: true, lenderName: "Me" },
];

const card = (name: string) => screen.getByRole("heading", { name }).closest("li") as HTMLElement;
const lastArgs = () => queryArgs["tools:list"].at(-1);

beforeEach(() => {
  resetConvexMock();
  paginated["tools:list"] = { results: tools, status: "Exhausted" };
});

describe("ToolsScreen (the board)", () => {
  test("cards show photo or category tile, status, category, condition and lender", () => {
    render(<ToolsScreen />);
    expect(within(card("Ladder")).getByRole("img", { name: "Ladder" })).toHaveAttribute("src", "https://convex.example/img/1");
    expect(within(card("Ladder")).getByText("Available")).toBeInTheDocument();
    expect(within(card("Ladder")).getByText("Hand tools").className).toContain("bg-preset-blue-soft");
    expect(within(card("Ladder")).getByText("Trusted lender")).toBeInTheDocument();
    expect(within(card("Ladder")).getByText("Ada")).toBeInTheDocument();
    expect(within(card("Tent")).getByText("On loan")).toBeInTheDocument();
    expect(within(card("Tent")).queryByRole("img", { name: "Tent" })).toBeNull(); // placeholder tile is decorative
    expect(within(card("My mower")).getByText("Your listing")).toBeInTheDocument();
  });

  test("you can't request your own tool", () => {
    render(<ToolsScreen />);
    expect(within(card("Ladder")).getByRole("button", { name: "Request to borrow" })).toBeInTheDocument();
    expect(within(card("My mower")).queryByRole("button", { name: "Request to borrow" })).toBeNull();
  });

  test("search, category chips and Available only all go to the server, and into the URL", async () => {
    render(<ToolsScreen />);
    expect(lastArgs()).toEqual({ search: undefined, category: undefined, availableOnly: undefined });
    await userEvent.type(screen.getByRole("searchbox", { name: "Search tools" }), "drill");
    await vi.waitFor(() => expect(lastArgs()).toMatchObject({ search: "drill" }));
    await userEvent.click(screen.getByRole("radio", { name: "Garden" }));
    await userEvent.click(screen.getByRole("switch", { name: "Available only" }));
    expect(lastArgs()).toEqual({ search: "drill", category: "garden", availableOnly: true });
    expect(navigation.href).toBe("/?q=drill&category=garden&available=1");
    await userEvent.click(screen.getByRole("radio", { name: "All" }));
    expect(lastArgs()).toMatchObject({ category: undefined });
  });

  test("chips are one tab stop with arrow-key selection", async () => {
    render(<ToolsScreen />);
    const group = screen.getByRole("radiogroup", { name: "Category" });
    const radios = within(group).getAllByRole("radio");
    expect(radios.filter((r) => r.tabIndex === 0)).toHaveLength(1);
    radios[0].focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(within(group).getByRole("radio", { name: "Power tools" })).toHaveAttribute("aria-checked", "true");
  });

  test("three views: cards (default), tiles and list, kept in the URL", async () => {
    render(<ToolsScreen />);
    const switcher = screen.getByRole("radiogroup", { name: "View" });
    expect(within(switcher).getByRole("radio", { name: "Cards" })).toHaveAttribute("aria-checked", "true");
    const list = () => screen.getByRole("heading", { name: "Ladder" }).closest("ul") as HTMLElement;
    expect(list()).toHaveAttribute("data-view", "cards");

    await userEvent.click(within(switcher).getByRole("radio", { name: "Tiles" }));
    expect(navigation.href).toBe("/?view=tiles");
    expect(list()).toHaveAttribute("data-view", "tiles");
    expect(list().className).toContain("lg:grid-cols-4");

    await userEvent.click(within(switcher).getByRole("radio", { name: "List" }));
    expect(navigation.href).toBe("/?view=list");
    expect(list()).toHaveAttribute("data-view", "list");
    // Every view keeps the essentials and the action.
    expect(within(card("Ladder")).getByText("Hand tools")).toBeInTheDocument();
    expect(within(card("Ladder")).getByText("Available")).toBeInTheDocument();
    expect(within(card("Ladder")).getByRole("button", { name: "Request to borrow" })).toBeInTheDocument();
    expect(within(card("My mower")).getByText(/Your listing/)).toBeInTheDocument();

    await userEvent.click(within(switcher).getByRole("radio", { name: "Cards" }));
    expect(navigation.href).toBe("/"); // the default isn't written to the URL
  });

  test("the view is read back from the URL and unknown values fall back to cards", () => {
    navigation.reset("/?view=list");
    const { unmount } = render(<ToolsScreen />);
    expect(screen.getByRole("radio", { name: "List" })).toHaveAttribute("aria-checked", "true");
    unmount();
    navigation.reset("/?view=bogus");
    render(<ToolsScreen />);
    expect(screen.getByRole("radio", { name: "Cards" })).toHaveAttribute("aria-checked", "true");
  });

  test.each(["tiles", "list"])("the %s view has no axe violations", async (view) => {
    navigation.reset(`/?view=${view}`);
    const { container } = render(<ToolsScreen />);
    expect(await axeViolations(container)).toEqual([]);
  });

  test("filtered with no results offers to clear the filters", async () => {
    navigation.reset("/?q=zzz&available=1");
    paginated["tools:list"] = { results: [], status: "Exhausted" };
    render(<ToolsScreen />);
    expect(screen.getByText('No tools match "zzz"')).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(navigation.href).toBe("/");
    expect(screen.getByRole("searchbox", { name: "Search tools" })).toHaveValue("");
  });

  test("Load more fetches the next page", async () => {
    paginated["tools:list"].status = "CanLoadMore";
    render(<ToolsScreen />);
    await userEvent.click(screen.getByRole("button", { name: "Load more tools" }));
    expect(loadMore).toHaveBeenCalledWith(BOARD_PAGE_SIZE);
  });

  test("shows a busy skeleton while loading", () => {
    paginated["tools:list"] = { results: [], status: "LoadingFirstPage" };
    render(<ToolsScreen />);
    expect(screen.getByRole("list", { name: "Loading tools" })).toHaveAttribute("aria-busy", "true");
  });

  test("requesting sends the tool id and dates, then confirms", async () => {
    render(<ToolsScreen />);
    await userEvent.click(within(card("Ladder")).getByRole("button", { name: "Request to borrow" }));
    await userEvent.click(within(card("Ladder")).getByRole("button", { name: "Send request" }));
    expect(mutations["loans:request"]).toHaveBeenCalledWith(expect.objectContaining({ toolId: "t1", startDate: expect.any(String), endDate: expect.any(String) }));
    expect(await within(card("Ladder")).findByText(/Request sent/)).toBeInTheDocument();
  });

  test("has no axe violations", async () => {
    const { container } = render(<ToolsScreen />);
    expect(await axeViolations(container)).toEqual([]);
  });
});

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { axeViolations } from "@/test/axe";
import { auth, paginated, queryArgs, resetConvexMock } from "@/test/convex-mock";
import { navigation } from "@/test/next-navigation-mock";
import { HomeScreen } from "./Home";

vi.mock("convex/react", async () => (await import("@/test/convex-mock")).convexReactMock);

// Clerk's SignInButton clones its child and opens the modal on click. Record
// the props it was given and wrap the child so we can see what it wraps.
const signInProps: Record<string, unknown>[] = [];
vi.mock("@clerk/nextjs", () => ({
  SignInButton: ({ children, ...props }: { children: ReactNode }) => {
    signInProps.push(props);
    return <span data-testid="clerk-sign-in">{children}</span>;
  },
}));

const tools = [
  { _id: "t1", name: "Cordless drill", category: "power_tools" },
  { _id: "t2", name: "Two-person tent", category: "camping" },
  { _id: "t3", name: "Leaf rake", category: "garden" },
];

beforeEach(() => {
  resetConvexMock();
  signInProps.length = 0;
  paginated["tools:listPublic"] = { results: tools, status: "Exhausted" };
});

const list = () => screen.getByRole("region", { name: "Available now" });
const lastArgs = () => queryArgs["tools:listPublic"].at(-1);

describe("HomeScreen (public landing)", () => {
  test("tagline, then How it works, then the available tools", () => {
    render(<HomeScreen />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Borrow what you need. Lend what you don't.");
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["How it works", "Available now"]);
    const steps = within(screen.getByRole("region", { name: "How it works" })).getByRole("list");
    expect(steps.tagName).toBe("OL");
    expect(within(steps).getAllByRole("listitem")).toHaveLength(3);
  });

  test("each tool shows its name and a coloured category badge, nothing else", () => {
    render(<HomeScreen />);
    const items = within(list()).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual(["Cordless drillPower tools", "Two-person tentCamping", "Leaf rakeGarden"]);
    // Scoped to the tool cards: the category chips above repeat the labels.
    expect(within(items[0]).getByText("Power tools").className).toContain("bg-preset-orange-soft");
    expect(within(items[2]).getByText("Garden").className).toContain("bg-preset-green-soft");
    expect(within(list()).queryAllByRole("link")).toEqual([]);
  });

  test("search and category go to the server and into the URL", async () => {
    render(<HomeScreen />);
    expect(lastArgs()).toMatchObject({ search: undefined, category: undefined });
    await userEvent.type(screen.getByRole("searchbox", { name: "Search available tools" }), "drill");
    await vi.waitFor(() => expect(lastArgs()).toMatchObject({ search: "drill", category: undefined }));
    expect(navigation.href).toBe("/?q=drill");
    await userEvent.click(within(list()).getByRole("radio", { name: "Garden" }));
    expect(lastArgs()).toMatchObject({ search: "drill", category: "garden" });
    expect(navigation.href).toContain("category=garden");
  });

  test("filters are read back from the URL", () => {
    navigation.reset("/?q=rake&category=garden");
    render(<HomeScreen />);
    expect(screen.getByRole("searchbox", { name: "Search available tools" })).toHaveValue("rake");
    expect(within(list()).getByRole("radio", { name: "Garden" })).toHaveAttribute("aria-checked", "true");
    expect(lastArgs()).toMatchObject({ search: "rake", category: "garden" });
  });

  test("Next is available while the server has more", async () => {
    paginated["tools:listPublic"].status = "CanLoadMore";
    render(<HomeScreen />);
    expect(screen.getByText("Showing 1–3 of 50 tools")).toHaveTextContent("Page 1 · Showing 1–3 of 50 tools");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(lastArgs()).toMatchObject({ pageNumber: 2, pageSize: 10 });
  });

  test("loading skeleton, and empty states with and without filters", () => {
    paginated["tools:listPublic"] = { results: [], status: "LoadingFirstPage" };
    const { rerender } = render(<HomeScreen />);
    expect(within(list()).getByRole("list", { name: "Loading tools" })).toHaveAttribute("aria-busy", "true");
    paginated["tools:listPublic"] = { results: [], status: "Exhausted" };
    rerender(<HomeScreen />);
    expect(within(list()).getByText("No tools listed yet")).toBeInTheDocument();
  });

  test("signed out: both Clerk buttons land on /tools after sign-in", () => {
    render(<HomeScreen />);
    expect(within(screen.getByTestId("clerk-sign-in")).getByRole("button", { name: "Sign in to lend or borrow" })).toBeInTheDocument();
    expect(signInProps.at(-1)).toMatchObject({ mode: "modal", forceRedirectUrl: "/tools", signUpForceRedirectUrl: "/tools" });
  });

  test("signed in: the sign-in button is replaced by a link into the app", () => {
    auth.signedIn = true;
    render(<HomeScreen />);
    expect(screen.queryByRole("button", { name: "Sign in to lend or borrow" })).toBeNull();
    expect(screen.getByRole("link", { name: "Browse tools" })).toHaveAttribute("href", "/tools");
  });

  test("has no axe violations", async () => {
    const { container } = render(<HomeScreen />);
    expect(await axeViolations(container)).toEqual([]);
  });
});

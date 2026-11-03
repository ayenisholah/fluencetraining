import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { axeViolations } from "@/test/axe";
import { auth, queryArgs, queryResults, resetConvexMock } from "@/test/convex-mock";
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
  queryResults["tools:listPublic"] = tools;
});

const list = () => screen.getByRole("region", { name: "Available now" });

describe("HomeScreen (public landing)", () => {
  test("shows the LendLoop tagline as the page heading", () => {
    render(<HomeScreen />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Borrow what you need. Lend what you don't.");
    expect(screen.getByText(/LendLoop is a neighbourhood board/)).toBeInTheDocument();
  });

  test("reads the public Convex query with no arguments", () => {
    render(<HomeScreen />);
    expect(queryArgs["tools:listPublic"]).toBeDefined();
    expect(queryArgs["tools:listPublic"].at(-1)).toBeUndefined();
  });

  test("lists each tool's name and category label only", () => {
    render(<HomeScreen />);
    const items = within(list()).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      "Cordless drillPower tools",
      "Two-person tentCamping",
      "Leaf rakeGarden",
    ]);
  });

  test("the list is read-only: no links or buttons on tools", () => {
    render(<HomeScreen />);
    expect(within(list()).queryAllByRole("link")).toEqual([]);
    expect(within(list()).queryAllByRole("button")).toEqual([]);
  });

  test("shows a busy skeleton while loading", () => {
    queryResults["tools:listPublic"] = undefined;
    render(<HomeScreen />);
    const skeleton = within(list()).getByRole("list", { name: "Loading tools" });
    expect(skeleton).toHaveAttribute("aria-busy", "true");
  });

  test("shows an empty state when nothing is listed", () => {
    queryResults["tools:listPublic"] = [];
    render(<HomeScreen />);
    expect(within(list()).getByText("No tools listed yet")).toBeInTheDocument();
  });

  test("signed out: 'Sign in to lend or borrow' is a Clerk modal sign-in", () => {
    render(<HomeScreen />);
    const wrapper = screen.getByTestId("clerk-sign-in");
    expect(within(wrapper).getByRole("button", { name: "Sign in to lend or borrow" })).toBeInTheDocument();
    expect(signInProps.at(-1)).toMatchObject({ mode: "modal" });
    expect(screen.queryByRole("link", { name: "Browse tools" })).toBeNull();
  });

  test("signed in: the sign-in button is replaced by a link into the app", () => {
    auth.signedIn = true;
    render(<HomeScreen />);
    expect(screen.queryByRole("button", { name: "Sign in to lend or borrow" })).toBeNull();
    expect(screen.getByRole("link", { name: "Browse tools" })).toHaveAttribute("href", "/tools");
  });

  test("has no axe violations (loaded, loading and empty)", async () => {
    for (const value of [tools, undefined, []]) {
      queryResults["tools:listPublic"] = value;
      const { container, unmount } = render(<HomeScreen />);
      expect(await axeViolations(container)).toEqual([]);
      unmount();
    }
  });
});

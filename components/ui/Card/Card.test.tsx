import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { Card, CardHeader } from "./Card";

describe("Card", () => {
  test("renders as the requested element with a header", () => {
    render(
      <ul>
        <Card as="li" data-testid="card">
          <CardHeader title="Members" description="People" actions={<button>Add</button>} />
        </Card>
      </ul>,
    );
    expect(screen.getByTestId("card").tagName).toBe("LI");
    expect(screen.getByRole("heading", { name: "Members" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });
  test("padding none", () => {
    render(<Card padding="none" data-testid="c" />);
    expect(screen.getByTestId("c").className).not.toContain("p-5");
  });
});

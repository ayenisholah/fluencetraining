import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { axeViolations } from "@/test/axe";
import { PlusIcon } from "../icons";
import { Button, buttonVariants } from "./Button";

describe("Button", () => {
  test("renders a type=button by default and handles clicks", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveAttribute("type", "button");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  test("applies variant and size classes", () => {
    render(
      <Button variant="ghost" size="lg">
        Go
      </Button>,
    );
    const cls = screen.getByRole("button").className;
    expect(cls).toContain("border-dim");
    expect(cls).toContain("h-14");
    expect(buttonVariants({ variant: "solid", size: "sm" })).toContain("bg-brand");
  });

  test("loading blocks clicks and announces busy", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick} leftIcon={<PlusIcon data-testid="icon" />}>
        Saving
      </Button>,
    );
    const button = screen.getByRole("button", { name: /saving/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByTestId("icon")).toBeNull();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  test("forwards refs and native attributes", () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(
      <Button ref={ref} type="submit" form="f" aria-describedby="x">
        Send
      </Button>,
    );
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current).toHaveAttribute("type", "submit");
    expect(ref.current).toHaveAttribute("form", "f");
  });

  test("has no axe violations", async () => {
    const { container } = render(<Button>OK</Button>);
    expect(await axeViolations(container)).toEqual([]);
  });
});

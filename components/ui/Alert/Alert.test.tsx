import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { Alert } from "./Alert";
import { EmptyState } from "../EmptyState/EmptyState";
import { PageHeader } from "../PageHeader/PageHeader";
import { Spinner } from "../Spinner/Spinner";

describe("feedback components", () => {
  test("danger alerts are assertive, others polite", () => {
    const { rerender } = render(<Alert tone="danger">Broken</Alert>);
    expect(screen.getByRole("alert")).toHaveTextContent("Broken");
    rerender(<Alert tone="success">Saved</Alert>);
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });
  test("empty alert renders nothing", () => {
    const { container } = render(<Alert tone="danger">{undefined}</Alert>);
    expect(container).toBeEmptyDOMElement();
  });
  test("spinner announces loading unless told not to", () => {
    const { rerender } = render(<Spinner />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    rerender(<Spinner label={null} />);
    expect(screen.queryByRole("status")).toBeNull();
  });
  test("empty state and page header", () => {
    render(
      <>
        <PageHeader title="My listings" description="Yours" actions={<button>New</button>} />
        <EmptyState title="Nothing yet" action={<button>Add</button>} />
      </>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "My listings" })).toBeInTheDocument();
    expect(screen.getByText("Nothing yet")).toBeInTheDocument();
  });
});

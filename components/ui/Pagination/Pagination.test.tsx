import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { axeViolations } from "@/test/axe";
import type { PageControls } from "@/lib/pagination";
import { Pagination } from "./Pagination";

const page = (over: Partial<PageControls> = {}): PageControls => ({
  page: 1,
  pageSize: 10,
  count: 10,
  totalCount: 100,
  totalPages: 10,
  loading: false,
  hasPrevious: false,
  hasNext: true,
  goToPage: vi.fn(),
  previous: vi.fn(),
  next: vi.fn(),
  setPageSize: vi.fn(),
  ...over,
});

test("page size options and navigation are accessible", async () => {
  const pagination = page();
  const { container } = render(<Pagination pagination={pagination} noun="tools" />);
  expect(screen.getByRole("navigation", { name: "tools pagination" })).toBeInTheDocument();
  expect(screen.getByLabelText("Page 1")).toHaveAttribute("aria-current", "page");
  expect(screen.getByLabelText("Page 1").tagName).toBe("BUTTON");
  expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  expect(screen.getAllByText("Items per page")).toHaveLength(1);
  await userEvent.click(screen.getByRole("button", { name: "Page 5" }));
  expect(pagination.goToPage).toHaveBeenCalledWith(5);
  await userEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(pagination.next).toHaveBeenCalledOnce();
  await userEvent.click(screen.getByRole("combobox", { name: "Items per page" }));
  expect(screen.getAllByRole("option").map((el) => el.textContent)).toEqual(["10", "25", "50", "100"]);
  await userEvent.click(screen.getByRole("option", { name: "25" }));
  expect(pagination.setPageSize).toHaveBeenCalledWith(25);
  expect(await axeViolations(container)).toEqual([]);
});

test("empty and loading pages retain controls with unavailable actions disabled", () => {
  const { rerender } = render(
    <Pagination pagination={page({ count: 0, totalCount: 0, totalPages: 0, hasNext: false })} />,
  );
  expect(screen.getByText("0 items")).toHaveTextContent("Page 1 · 0 items");
  expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  rerender(<Pagination pagination={page({ page: 2, loading: true, hasPrevious: true })} />);
  expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  expect(screen.getByRole("combobox")).toBeDisabled();
});

test("compact selector supports keyboard selection and Escape returns focus", async () => {
  const pagination = page();
  render(<Pagination pagination={pagination} />);
  const selector = screen.getByRole("combobox", { name: "Items per page" });
  await userEvent.tab();
  expect(selector).toHaveFocus();
  await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
  expect(pagination.setPageSize).toHaveBeenCalledWith(25);
  expect(selector).toHaveFocus();
  await userEvent.keyboard("{ArrowDown}{Escape}");
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(selector).toHaveFocus();
  await userEvent.tab();
  expect(screen.getByRole("button", { name: "Page 1" })).toHaveFocus();
});

test("middle pages expose endpoints and accurate result ranges", async () => {
  const pagination = page({ page: 5, totalPages: 11, totalCount: 105, hasPrevious: true });
  const { rerender } = render(<Pagination pagination={pagination} noun="tools" />);
  expect(screen.getByText("Showing 41–50 of 105 tools")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Page 1" }));
  expect(pagination.goToPage).toHaveBeenCalledWith(1);
  await userEvent.click(screen.getByRole("button", { name: "Page 11" }));
  expect(pagination.goToPage).toHaveBeenCalledWith(11);
  expect(screen.getAllByText("…")).toHaveLength(2);
  rerender(
    <Pagination
      pagination={page({ page: 11, count: 5, totalCount: 105, totalPages: 11, hasPrevious: true, hasNext: false })}
      noun="tools"
    />,
  );
  expect(screen.getByText("Showing 101–105 of 105 tools")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
});

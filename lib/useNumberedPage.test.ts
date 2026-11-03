import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "@/convex/_generated/api";
import { useNumberedPage } from "./useNumberedPage";

const query = vi.hoisted(() => vi.fn());
vi.mock("convex/react", () => ({ useQuery: query }));

beforeEach(() => {
  query.mockReset();
  query.mockImplementation((_ref, { pageNumber, pageSize }) => ({
    page: [{ _id: pageNumber === 1 ? "first" : "second" }], pageNumber, pageSize, totalPages: 5, totalCount: 50,
  }));
});

describe("useNumberedPage", () => {
  test("requests one server page, replaces rows, and returns using page numbers", () => {
    const { result } = renderHook(() => useNumberedPage(api.tools.list, {}));
    expect(query).toHaveBeenLastCalledWith(api.tools.list, { pageNumber: 1, pageSize: 10 });
    expect(result.current.pagination.hasPrevious).toBe(false);
    act(() => result.current.pagination.goToPage(5));
    expect(query).toHaveBeenLastCalledWith(api.tools.list, { pageNumber: 5, pageSize: 10 });
    expect(result.current.pagination).toMatchObject({ page: 5, hasNext: false });
    act(() => result.current.pagination.goToPage(1));
    act(() => result.current.pagination.next());
    expect(result.current.results).toEqual([{ _id: "second" }]);
    expect(result.current.pagination).toMatchObject({ page: 2, hasNext: true, hasPrevious: true });
    act(() => result.current.pagination.previous());
    expect(result.current.results).toEqual([{ _id: "first" }]);
    expect(result.current.pagination.page).toBe(1);
  });

  test("size and filter changes reset pages before making the next request", () => {
    const { result, rerender } = renderHook(({ search }) => useNumberedPage(api.tools.list, { search }), { initialProps: { search: "drill" } });
    act(() => result.current.pagination.next());
    act(() => result.current.pagination.setPageSize(25));
    expect(query).toHaveBeenLastCalledWith(api.tools.list, { search: "drill", pageNumber: 1, pageSize: 25 });
    act(() => result.current.pagination.next());
    query.mockClear();
    rerender({ search: "tent" });
    for (const [, args] of query.mock.calls) expect(args).toMatchObject({ search: "tent", pageNumber: 1 });
    expect(result.current.pagination.pageSize).toBe(25);
  });

  test("loading prevents navigation; deleting the final row returns to the previous page", () => {
    const { result, rerender } = renderHook(() => useNumberedPage(api.tools.list, {}));
    act(() => result.current.pagination.next());
    query.mockReturnValue(undefined);
    rerender();
    act(() => { result.current.pagination.next(); result.current.pagination.previous(); });
    expect(result.current.pagination).toMatchObject({ page: 2, loading: true, hasNext: false });
    query.mockReturnValue({ page: [], pageNumber: 1, pageSize: 10, totalPages: 0, totalCount: 0 });
    rerender();
    expect(result.current.pagination).toMatchObject({ page: 1, count: 0, hasPrevious: false, hasNext: false });
  });

  test("list instances keep independent sizes and pages", () => {
    const { result } = renderHook(() => ({ tools: useNumberedPage(api.tools.list, {}), users: useNumberedPage(api.admin.users, {}) }));
    act(() => result.current.tools.pagination.setPageSize(50));
    act(() => result.current.tools.pagination.next());
    expect(result.current.tools.pagination).toMatchObject({ page: 2, pageSize: 50 });
    expect(result.current.users.pagination).toMatchObject({ page: 1, pageSize: 10 });
  });
});

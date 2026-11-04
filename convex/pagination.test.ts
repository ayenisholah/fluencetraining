import { expect, test } from "vitest";
import { numberedPage } from "./lib/pagination";
import { pageNumbers } from "../lib/pagination";

async function* rows(count: number) {
  for (let i = 1; i <= count; i++) yield i;
}

test("direct jumps return only the requested page and exact totals", async () => {
  expect(await numberedPage(rows(93), { pageNumber: 5, pageSize: 10 })).toEqual({
    page: [41, 42, 43, 44, 45, 46, 47, 48, 49, 50],
    pageNumber: 5,
    pageSize: 10,
    totalCount: 93,
    totalPages: 10,
  });
});
test("out of range and empty pages clamp", async () => {
  expect(await numberedPage(rows(23), { pageNumber: 50, pageSize: 10 })).toMatchObject({
    page: [21, 22, 23],
    pageNumber: 3,
    totalPages: 3,
  });
  expect(await numberedPage(rows(0), { pageNumber: 5, pageSize: 10 })).toMatchObject({
    page: [],
    pageNumber: 1,
    totalCount: 0,
    totalPages: 0,
  });
});
test.each([
  { pageNumber: 0, pageSize: 10 },
  { pageNumber: 1.5, pageSize: 10 },
  { pageNumber: 1, pageSize: 11 },
])("rejects invalid arguments %o", async (args) => {
  await expect(numberedPage(rows(100), args)).rejects.toThrow();
});
test("number window is bounded and centered", () => {
  expect(pageNumbers(1, 10)).toEqual([1, 2, 3, 4, 5, "ellipsis-end", 10]);
  expect(pageNumbers(5, 10)).toEqual([1, "ellipsis-start", 4, 5, 6, "ellipsis-end", 10]);
  expect(pageNumbers(10, 10)).toEqual([1, "ellipsis-start", 6, 7, 8, 9, 10]);
  expect(pageNumbers(1, 2)).toEqual([1, 2]);
  expect(pageNumbers(1, 0)).toEqual([]);
});

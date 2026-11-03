import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { Pagination } from "./Pagination";

const meta = {
  title: "Components/Pagination",
  component: Pagination,
  args: {
    noun: "tools",
    pagination: { page: 1, pageSize: 10, count: 10, totalCount: 100, totalPages: 10, loading: false, hasPrevious: false, hasNext: true,
      goToPage: fn(), previous: fn(), next: fn(), setPageSize: fn() },
  },
} satisfies Meta<typeof Pagination>;
export default meta;
type Story = StoryObj<typeof meta>;
export const FirstPage: Story = {};
export const MiddlePage: Story = { args: { pagination: { ...meta.args.pagination, page: 5, totalCount: 105, totalPages: 11, hasPrevious: true } } };
export const LastPage: Story = { args: { pagination: { ...meta.args.pagination, page: 10, count: 3, totalCount: 93, hasPrevious: true, hasNext: false } } };
export const Empty: Story = { args: { pagination: { ...meta.args.pagination, count: 0, totalCount: 0, totalPages: 0, hasNext: false } } };
export const Loading: Story = { args: { pagination: { ...meta.args.pagination, loading: true } } };
export const FirstPageDark: Story = { ...FirstPage, globals: { theme: "dark" } };
export const MiddlePageDark: Story = { ...MiddlePage, globals: { theme: "dark" } };
export const LastPageDark: Story = { ...LastPage, globals: { theme: "dark" } };
export const EmptyDark: Story = { ...Empty, globals: { theme: "dark" } };
export const LoadingDark: Story = { ...Loading, globals: { theme: "dark" } };
export const Narrow: Story = {
  ...MiddlePage,
  decorators: [(Story) => <div className="max-w-[327px]"><Story /></div>],
};
export const NarrowDark: Story = { ...Narrow, globals: { theme: "dark" } };

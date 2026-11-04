import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { PageSkeleton } from "./PageSkeleton";

const meta = {
  title: "Shell/PageSkeleton",
  component: PageSkeleton,
  parameters: { layout: "padded" },
} satisfies Meta<typeof PageSkeleton>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The usual brief load on every signed-in page: shape only, status for screen readers. */
export const Loading: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent("Loading…");
  },
};

/** First sign-in, while users.store creates the account row. */
export const SettingUp: Story = {
  args: { settingUp: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent("Setting up your account…");
  },
};

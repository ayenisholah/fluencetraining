import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { addDays, formatLong } from "@/lib/calendar";
import { todayIso } from "@/lib/format";
import { DatePicker } from "./DatePicker";

type Args = {
  label: string;
  withLimits?: boolean;
  withRange?: boolean;
  error?: string;
  hint?: string;
  disabled?: boolean;
  empty?: boolean;
};

function Demo({ withLimits, withRange, empty, ...args }: Args) {
  const today = todayIso();
  const [value, setValue] = useState(empty ? "" : addDays(today, 2));
  return (
    <div className="w-[220px] pb-[380px]">
      <DatePicker
        {...args}
        value={value}
        onValueChange={setValue}
        min={withLimits ? today : undefined}
        max={withLimits ? addDays(today, 30) : undefined}
        rangeStart={withRange ? addDays(today, 1) : undefined}
        rangeEnd={withRange ? addDays(today, 4) : undefined}
      />
    </div>
  );
}

const meta = { title: "Components/DatePicker", component: Demo, args: { label: "From" } } satisfies Meta<typeof Demo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = { args: { empty: true } };
export const WithLimits: Story = { args: { withLimits: true, hint: "Up to 30 days." } };
export const Range: Story = {
  args: { withRange: true, label: "Until" },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: /^Until/ }));
  },
};
export const Error: Story = { args: { error: "The start date is in the past." } };
export const Disabled: Story = { args: { disabled: true } };
export const Keyboard: Story = {
  args: { withLimits: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /^From/ }));
    const start = addDays(todayIso(), 2);
    await expect(canvas.getByRole("button", { name: formatLong(start) })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(canvas.getByRole("button", { name: formatLong(addDays(start, 1)) })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(canvas.queryByRole("dialog")).toBeNull();
  },
};

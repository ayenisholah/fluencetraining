import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { SegmentedControl } from "./SegmentedControl";

function Demo() {
  const [value, setValue] = useState("1");
  return (
    <SegmentedControl
      aria-label="Toggle"
      value={value}
      onChange={setValue}
      options={[{ value: "1", label: "Toggle 1" }, { value: "2", label: "Toggle 2" }, { value: "3", label: "Toggle 3" }]}
    />
  );
}

const meta = { title: "Components/SegmentedControl", component: Demo } satisfies Meta<typeof Demo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const first = canvas.getByRole("radio", { name: "Toggle 1" });
    first.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(canvas.getByRole("radio", { name: "Toggle 2" })).toHaveAttribute("aria-checked", "true");
  },
};

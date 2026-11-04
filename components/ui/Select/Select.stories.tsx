import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { BoxIcon, ShieldIcon, ToolIcon } from "../icons";
import { Select, type SelectOption } from "./Select";

const categories: SelectOption[] = [
  { value: "", label: "All categories" },
  { value: "power_tools", label: "Power tools" },
  { value: "hand_tools", label: "Hand tools" },
  { value: "garden", label: "Garden" },
  { value: "kitchen", label: "Kitchen" },
  { value: "camping", label: "Camping" },
  { value: "cleaning", label: "Cleaning" },
  { value: "other", label: "Other" },
];

type Args = {
  label: string;
  hideLabel?: boolean;
  error?: string;
  hint?: string;
  disabled?: boolean;
  withIcons?: boolean;
};

function Demo({ withIcons, ...args }: Args) {
  const opts = withIcons
    ? [
        { value: "tools", label: "All tools", icon: <ToolIcon /> },
        { value: "listings", label: "My listings", icon: <BoxIcon /> },
        { value: "admin", label: "Admin", icon: <ShieldIcon /> },
      ]
    : categories;
  const [value, setValue] = useState(opts[withIcons ? 0 : 1].value);
  return (
    <div className="w-[260px] pb-80">
      <Select {...args} options={opts} value={value} onValueChange={setValue} />
    </div>
  );
}

const meta = { title: "Components/Select", component: Demo, args: { label: "Category" } } satisfies Meta<typeof Demo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Labelled: Story = {};
/** Toolbar filter, as Figma's "All Category" field. */
export const Filter: Story = { args: { hideLabel: true } };
export const WithIcons: Story = { args: { label: "Go to", withIcons: true } };
export const Error: Story = { args: { error: "Pick a category." } };
export const Disabled: Story = { args: { disabled: true } };
export const Open: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("combobox", { name: /Category/ }));
    await expect(canvas.getByRole("listbox")).toBeVisible();
  },
};
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("combobox", { name: /Category/ });
    trigger.focus();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    await expect(trigger).toHaveTextContent("Hand tools");
    await userEvent.keyboard("g");
    await expect(trigger).toHaveTextContent("Garden");
  },
};

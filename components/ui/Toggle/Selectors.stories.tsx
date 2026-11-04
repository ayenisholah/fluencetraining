import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { Checkbox, Radio } from "../Checkbox/Checkbox";
import { RangeSlider } from "../Slider/RangeSlider";
import { Toggle } from "./Toggle";

function ToggleDemo({ size = "md" as "md" | "sm", label }: { size?: "md" | "sm"; label?: string }) {
  const [on, setOn] = useState(true);
  return (
    <Toggle
      size={size}
      label={label}
      aria-label={label ? undefined : "Notifications"}
      checked={on}
      onCheckedChange={setOn}
    />
  );
}

const meta = { title: "Components/Selectors", component: ToggleDemo } satisfies Meta<typeof ToggleDemo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Toggles: Story = {
  render: () => (
    <div className="grid w-fit grid-cols-2 gap-6">
      <ToggleDemo />
      <Toggle aria-label="Off" checked={false} onCheckedChange={() => {}} />
      <Toggle aria-label="Disabled" checked disabled onCheckedChange={() => {}} />
      <ToggleDemo size="sm" label="Toggle On" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const sw = within(canvasElement).getAllByRole("switch")[0];
    await userEvent.click(sw);
    await expect(sw).toHaveAttribute("aria-checked", "false");
  },
};

export const CheckboxAndRadio: Story = {
  render: () => (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-body-bold">Notify me about</legend>
      <Checkbox label="New requests" defaultChecked />
      <Checkbox label="Overdue loans" />
      <Checkbox label="Some listings selected" indeterminate />
      <Checkbox label="Selection unavailable" disabled />
      <div className="flex gap-4">
        <Radio name="freq" label="Instantly" defaultChecked />
        <Radio name="freq" label="Daily digest" />
      </div>
    </fieldset>
  ),
};

function SliderDemo() {
  const [value, setValue] = useState<[number, number]>([14, 83]);
  return (
    <div className="w-72">
      <RangeSlider label="Loan length" min={0} max={100} value={value} onChange={setValue} />
    </div>
  );
}

export const Slider: Story = { render: () => <SliderDemo /> };

export const CheckboxAndRadioDark: Story = { ...CheckboxAndRadio, globals: { theme: "dark" } };

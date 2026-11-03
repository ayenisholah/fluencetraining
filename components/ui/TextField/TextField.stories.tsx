import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { TextField } from "./TextField";

// TextField's props are a union (input | textarea); stories use one flat shape.
type Args = {
  label: string;
  hint?: string;
  error?: string;
  placeholder?: string;
  defaultValue?: string;
  disabled?: boolean;
  multiline?: boolean;
  maxLengthHint?: number;
  type?: string;
};
const Field = TextField as unknown as React.ComponentType<Args>;

const meta = {
  title: "Components/TextField",
  component: Field,
  args: { label: "Label" },
  decorators: [(Story) => <div className="w-[306px]"><Story /></div>],
} satisfies Meta<typeof Field>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Rest: Story = {};
export const Filled: Story = { args: { defaultValue: "Input" } };
export const WithPlaceholder: Story = { args: { placeholder: "e.g. Cordless drill" } };
export const Hint: Story = { args: { hint: "Shown to neighbours." } };
export const Error: Story = { args: { error: "Please enter a valid entry.", defaultValue: "x" } };
export const Disabled: Story = { args: { disabled: true } };
export const Multiline: Story = { args: { multiline: true, label: "Short description", maxLengthHint: 500 } };
export const DateField: Story = { args: { type: "date", label: "From" } };
export const FloatsOnFocus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText("Label");
    await userEvent.click(input);
    await userEvent.type(input, "Ladder");
    await expect(input).toHaveValue("Ladder");
    await expect(canvas.getByText("Label").className).toContain("top-1.5");
  },
};

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CloseIcon, PlusIcon } from "../icons";
import { Control, IconButton } from "./Control";

const meta = { title: "Components/Control", component: Control, args: { children: "Control" } } satisfies Meta<typeof Control>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Body: Story = {};
export const Caption: Story = { args: { kind: "caption" } };
export const AllStyles: Story = {
  render: () => (
    <div className="space-y-3">
      {(["solid", "dim", "ghost"] as const).map((variant) => (
        <div key={variant} className="flex items-center gap-2">
          <Control variant={variant}>Control</Control>
          <Control variant={variant} kind="caption">Control</Control>
          <IconButton variant={variant} label="Add"><PlusIcon /></IconButton>
          <IconButton variant={variant} label="Remove" disabled><CloseIcon /></IconButton>
          <Control variant={variant} disabled>Control</Control>
        </div>
      ))}
    </div>
  ),
};

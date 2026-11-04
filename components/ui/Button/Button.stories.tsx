import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { PlusIcon, SendIcon } from "../icons";
import { Button } from "./Button";

const meta = {
  title: "Components/Button",
  component: Button,
  args: { children: "Button", onClick: fn() },
  argTypes: {
    variant: { control: "inline-radio", options: ["solid", "dim", "ghost", "danger"] },
    size: { control: "inline-radio", options: ["lg", "md", "sm"] },
  },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Solid: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Button" }));
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};
export const Dim: Story = { args: { variant: "dim" } };
export const Ghost: Story = { args: { variant: "ghost" } };
export const Danger: Story = { args: { variant: "danger", children: "Delete" } };
export const WithIcons: Story = { args: { leftIcon: <PlusIcon />, children: "List a tool", rightIcon: <SendIcon /> } };
export const Loading: Story = {
  args: { loading: true, children: "Saving" },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button");
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute("aria-busy", "true");
  },
};

/** The Figma matrix: three styles × rest / disabled, in all three sizes. */
export const Matrix: Story = {
  render: (args) => (
    <div className="grid w-fit grid-cols-[auto_repeat(3,auto)] items-center gap-4">
      {(["lg", "md", "sm"] as const).map((size) => (
        <div key={size} className="contents">
          <span className="text-description text-fg-muted">{size}</span>
          {(["solid", "dim", "ghost"] as const).map((variant) => (
            <div key={variant} className="flex gap-2">
              <Button {...args} size={size} variant={variant}>
                Button
              </Button>
              <Button {...args} size={size} variant={variant} disabled>
                Button
              </Button>
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
};

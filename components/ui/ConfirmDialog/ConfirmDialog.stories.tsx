import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ConvexError } from "convex/values";
import { expect, userEvent, within } from "storybook/test";
import { Button } from "../Button/Button";
import { useConfirm, type ConfirmOptions } from "./ConfirmDialog";

function Demo(props: Partial<ConfirmOptions>) {
  const { confirm, dialog } = useConfirm();
  return (
    <>
      <Button
        variant="danger"
        onClick={() =>
          confirm({
            title: 'Delete "Ladder"?',
            description: "It disappears from the board and any open requests for it are declined.",
            confirmLabel: "Delete listing",
            onConfirm: async () => {},
            ...props,
          })
        }
      >
        Delete
      </Button>
      {dialog}
    </>
  );
}

const meta = { title: "Components/ConfirmDialog", component: Demo } satisfies Meta<typeof Demo>;
export default meta;
type Story = StoryObj<typeof meta>;

const open: Story["play"] = async ({ canvasElement }) => {
  await userEvent.click(within(canvasElement).getByRole("button", { name: "Delete" }));
  await expect(within(document.body).getByRole("alertdialog")).toBeVisible();
};

export const Danger: Story = { play: open };
export const Brand: Story = {
  args: { tone: "brand", title: "Send this request?", confirmLabel: "Send", description: "The lender gets an email." },
  play: open,
};
export const ServerRefusal: Story = {
  args: {
    onConfirm: () =>
      Promise.reject(
        new ConvexError({ code: "BAD_REQUEST", message: "This tool is on loan. Mark it returned first." }),
      ),
  },
  play: async (ctx) => {
    await open(ctx);
    await userEvent.click(within(document.body).getByRole("button", { name: "Delete listing" }));
    await expect(await within(document.body).findByText(/on loan/)).toBeVisible();
  },
};

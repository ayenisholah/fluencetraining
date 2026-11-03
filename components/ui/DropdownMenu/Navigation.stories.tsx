import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { BoxIcon, ChartIcon, InboxIcon, MenuIcon, SendIcon, ToolIcon } from "../icons";
import { SidebarItem } from "../SidebarItem/SidebarItem";
import { ThemeToggle } from "../ThemeToggle/ThemeToggle";
import { DropdownMenu } from "./DropdownMenu";

const meta = { title: "Components/Navigation", component: DropdownMenu, args: { triggerLabel: "Menu", trigger: "Menu", items: [] } } satisfies Meta<typeof DropdownMenu>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Dropdown: Story = {
  args: {
    triggerLabel: "Open navigation",
    trigger: <span className="flex size-10 items-center justify-center rounded-pill border border-line"><MenuIcon size={20} /></span>,
    align: "start",
    items: [
      { key: "a", label: "View profile", icon: <ToolIcon /> },
      { key: "b", label: "My listings", icon: <BoxIcon />, active: true },
      { key: "c", label: "Incoming", icon: <InboxIcon /> },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Open navigation" }));
    await expect(canvas.getByRole("menu")).toBeVisible();
    await expect(canvas.getByRole("menuitem", { name: "View profile" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await expect(canvas.queryByRole("menu")).toBeNull();
  },
};

export const Sidebar: Story = {
  render: () => (
    <nav aria-label="Main" className="w-60 space-y-1 rounded-md bg-surface p-3">
      <SidebarItem href="#" icon={<ChartIcon />} label="Dashboard" />
      <SidebarItem href="#" icon={<ToolIcon />} label="All tools" active />
      <SidebarItem href="#" icon={<InboxIcon />} label="Incoming" count={3} />
      <SidebarItem href="#" icon={<SendIcon />} label="My requests" />
    </nav>
  ),
};

export const Theme: Story = { render: () => <ThemeToggle /> };

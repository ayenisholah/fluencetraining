import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ChartIcon, ClockIcon, InboxIcon } from "../icons";
import { StatWidget } from "./StatWidget";

const meta = { title: "Components/StatWidget", component: StatWidget, args: { label: "Total cashback", value: "$1,531" } } satisfies Meta<typeof StatWidget>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Up: Story = { args: { delta: { value: "+5.4%", direction: "up" }, icon: <ChartIcon /> } };
export const Down: Story = { args: { label: "Spend this week", value: "$540", delta: { value: "2.5%", direction: "down" } } };
export const Row: Story = {
  render: () => (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatWidget label="Open requests" value={4} icon={<InboxIcon />} />
      <StatWidget label="Overdue loans" value={1} icon={<ClockIcon />} delta={{ value: "needs attention", direction: "down" }} />
      <StatWidget label="Profit margin" value="$25k" icon={<ChartIcon />} delta={{ value: "+5%", direction: "up" }}>
        <svg viewBox="0 0 160 40" className="h-10 w-full text-accent-orange" aria-hidden>
          <path d="M0 30 C20 5 30 35 50 20 S80 35 100 25 130 5 160 30" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </StatWidget>
    </div>
  ),
};

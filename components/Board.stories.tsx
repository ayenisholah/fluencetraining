import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { CategoryBadge } from "./CategoryBadge";
import { CategoryChips } from "./CategoryChips";
import { HowItWorks } from "./HowItWorks";
import { ToolCard, ToolRow, ToolTile, type BoardTool } from "./ToolCard";
import { Button, SearchField } from "./ui";
import { CATEGORY_STYLES, type Category } from "@/lib/categories";

const meta = { title: "LendLoop/Board", component: ToolCard } satisfies Meta<typeof ToolCard>;
export default meta;
type Story = StoryObj<typeof meta>;

const tool: BoardTool = {
  _id: "t1",
  name: "Petrol lawnmower",
  category: "garden",
  condition: "good",
  description: "46 cm cut with a grass box. Returned with a full tank, please.",
  status: "available",
  imageUrl: null,
  isMine: false,
  lenderName: "Priya",
  trustedLender: true,
};

export const Cards: Story = {
  args: { tool, action: null },
  render: () => (
    <ul className="grid max-w-5xl gap-5 md:grid-cols-3">
      <ToolCard tool={tool} action={<Button size="sm">Request to borrow</Button>} />
      <ToolCard
        tool={{
          ...tool,
          _id: "t2",
          name: "Two-person tent",
          category: "camping",
          status: "on_loan",
          trustedLender: false,
        }}
        action={<Button size="sm">Request to borrow</Button>}
      />
      <ToolCard
        tool={{ ...tool, _id: "t3", name: "Stand mixer", category: "kitchen", isMine: true, trustedLender: false }}
        action={null}
      />
    </ul>
  ),
};

export const CategoryBadges: Story = {
  args: { tool, action: null },
  render: () => (
    <div className="flex flex-wrap gap-2">
      {Object.keys(CATEGORY_STYLES).map((c) => (
        <CategoryBadge key={c} category={c} />
      ))}
    </div>
  ),
};

function Toolbar() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  return (
    <div className="max-w-3xl space-y-4">
      <SearchField label="Search tools" value={q} onChange={setQ} />
      <CategoryChips value={category} onChange={setCategory} />
    </div>
  );
}
export const SearchAndChips: Story = { args: { tool, action: null }, render: () => <Toolbar /> };
export const Steps: Story = {
  args: { tool, action: null },
  render: () => (
    <div className="max-w-5xl">
      <HowItWorks />
    </div>
  ),
};

const more: BoardTool[] = [
  tool,
  { ...tool, _id: "t2", name: "Two-person tent", category: "camping", status: "on_loan", trustedLender: false },
  { ...tool, _id: "t3", name: "Stand mixer", category: "kitchen", isMine: true, trustedLender: false },
  { ...tool, _id: "t4", name: "18V impact driver", category: "power_tools", trustedLender: false },
];
export const Tiles: Story = {
  args: { tool, action: null },
  render: () => (
    <ul className="grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-4">
      {more.map((t) => (
        <ToolTile key={t._id} tool={t} action={t.isMine ? null : <Button size="sm">Request to borrow</Button>} />
      ))}
    </ul>
  ),
};
export const List: Story = {
  args: { tool, action: null },
  render: () => (
    <ul className="max-w-5xl space-y-2">
      {more.map((t) => (
        <ToolRow key={t._id} tool={t} action={t.isMine ? null : <Button size="sm">Request to borrow</Button>} />
      ))}
    </ul>
  ),
};

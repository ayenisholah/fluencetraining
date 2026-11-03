import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge, PRESET_COLORS, type PresetColor } from "./Badge";

const meta = { title: "Components/Badge", component: Badge, args: { children: "Badge" } } satisfies Meta<typeof Badge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const FigmaStyles: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Badge variant="solid">Badge</Badge>
      <Badge variant="solid" shape="bubble">2</Badge>
      <Badge variant="dim">Badge</Badge>
      <Badge variant="dim" shape="bubble">2</Badge>
      <Badge variant="ghost">Badge</Badge>
      <Badge variant="ghost" shape="bubble">2</Badge>
    </div>
  ),
};
export const StatusTones: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {(["neutral", "brand", "success", "warning", "danger", "info"] as const).map((tone) => (
        <Badge key={tone} tone={tone}>{tone}</Badge>
      ))}
    </div>
  ),
};

/** Preset colours: the fixed palette categories map onto (lib/categories.tsx). */
export const PresetColours: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(PRESET_COLORS) as PresetColor[]).map((color) => (
        <Badge key={color} color={color}>{color}</Badge>
      ))}
    </div>
  ),
};

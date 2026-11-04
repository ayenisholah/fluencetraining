import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Avatar, AvatarGroup, AVATAR_SIZES } from "./Avatar";

const meta = { title: "Components/Avatar", component: Avatar, args: { name: "Ada Lovelace" } } satisfies Meta<
  typeof Avatar
>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Initials: Story = {};
export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-3">
      {AVATAR_SIZES.map((size) => (
        <Avatar key={size} name="Shola Ayeni" size={size} />
      ))}
    </div>
  ),
};
export const WithStatus: Story = {
  render: () => (
    <div className="flex gap-3">
      <Avatar name="Ada Lovelace" status="online" />
      <Avatar name="Bob Builder" status="away" />
      <Avatar name="Eve Online" status="offline" />
    </div>
  ),
};
export const Group: Story = {
  render: () => (
    <AvatarGroup
      max={3}
      people={[{ name: "Ada L" }, { name: "Bob B" }, { name: "Cy D" }, { name: "Di E" }, { name: "Ed F" }]}
    />
  ),
};

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Mark } from "@/lib/brand";
import { Logo } from "./Logo";

const meta = { title: "Foundations/Brand", component: Logo, parameters: { layout: "fullscreen" } } satisfies Meta<
  typeof Logo
>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Combination wrench whose ring end is the loop: a tool that comes back. */
export const Mark_: Story = {
  name: "Mark",
  render: () => (
    <div className="space-y-6 p-6">
      {[
        { theme: "light", bg: "#f5f5fa" },
        { theme: "dark", bg: "#1f2128" },
      ].map(({ theme, bg }) => (
        <div key={theme} className="flex items-end gap-6 rounded-md p-6" style={{ background: bg }}>
          {[16, 24, 30, 64, 180].map((size) => (
            <figure key={size} className="flex flex-col items-center gap-2">
              <Mark size={size} title={`LendLoop mark, ${size}px`} />
              <figcaption className="text-description" style={{ color: theme === "dark" ? "#a9a9b7" : "#636373" }}>
                {size}px
              </figcaption>
            </figure>
          ))}
        </div>
      ))}
    </div>
  ),
};

export const Lockup: Story = {
  render: () => (
    <div className="flex gap-10 p-6">
      <Logo />
      <Logo compact />
    </div>
  ),
};

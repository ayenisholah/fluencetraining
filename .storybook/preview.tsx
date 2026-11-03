import type { Preview } from "@storybook/nextjs-vite";
import "../app/globals.css";

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Colour theme (sets data-theme on <html>)",
      toolbar: {
        title: "Theme",
        icon: "mirror",
        items: [
          { value: "light", title: "Day" },
          { value: "dark", title: "Night" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "light" },
  decorators: [
    (Story, context) => {
      document.documentElement.setAttribute("data-theme", context.globals.theme ?? "light");
      return (
        <div className="bg-canvas p-6 font-sans text-body text-fg">
          <Story />
        </div>
      );
    },
  ],
  parameters: {
    layout: "fullscreen",
    controls: { matchers: { color: /(background|color)$/i } },
    nextjs: { appDirectory: true },
    // Fail story tests on accessibility violations.
    a11y: { test: "error" },
  },
};

export default preview;

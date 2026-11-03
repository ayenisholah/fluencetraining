import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "../Button/Button";
import { Card, CardHeader } from "./Card";

const meta = { title: "Components/Card", component: Card } satisfies Meta<typeof Card>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithHeader: Story = {
  render: () => (
    <Card className="max-w-md">
      <CardHeader title="Best lenders" description="This month" actions={<Button size="sm">Report</Button>} />
      <p className="text-body text-fg-muted">Cards are flat surfaces with a hairline border.</p>
    </Card>
  ),
};

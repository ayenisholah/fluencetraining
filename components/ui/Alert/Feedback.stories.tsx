import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "../Button/Button";
import { EmptyState } from "../EmptyState/EmptyState";
import { InboxIcon } from "../icons";
import { PageHeader } from "../PageHeader/PageHeader";
import { Spinner } from "../Spinner/Spinner";
import { Alert } from "./Alert";

const meta = { title: "Components/Feedback", component: Alert } satisfies Meta<typeof Alert>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Alerts: Story = {
  render: () => (
    <div className="max-w-md space-y-3">
      <Alert tone="info" title="Heads up">Reminders go out at 08:00 UTC.</Alert>
      <Alert tone="success">Listing saved.</Alert>
      <Alert tone="warning">This tool is on loan.</Alert>
      <Alert tone="danger">You&apos;ve created a lot of listings in the last hour.</Alert>
    </div>
  ),
};
export const Empty: Story = {
  render: () => <EmptyState icon={<InboxIcon />} title="No requests yet" description="When a neighbour asks to borrow, it shows here." action={<Button size="sm">Browse tools</Button>} />,
};
export const Loading: Story = { render: () => <Spinner /> };
export const Header: Story = {
  render: () => <PageHeader title="My listings" description="Tools you're lending." actions={<Button>New listing</Button>} />,
};

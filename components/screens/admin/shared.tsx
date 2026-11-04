import type { ReactNode } from "react";
import { Alert, Card, CardHeader } from "@/components/ui";
import type { useRowAction } from "@/components/useRowAction";

/** One titled card on the admin dashboard. */
export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card as="section">
      <CardHeader title={title} description={description} />
      {children}
    </Card>
  );
}

/** Shared across sections so starting any admin action clears the last refusal. */
export type RowActions = ReturnType<typeof useRowAction>;

export function RowError({ actions, id }: { actions: RowActions; id: string }) {
  const message = actions.errorFor(id);
  return message ? (
    <Alert tone="danger" className="mt-2 w-full">
      {message}
    </Alert>
  ) : null;
}

"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { ToolForm } from "@/components/ToolForm";
import { ToolStatusBadge } from "@/components/ToolStatusBadge";
import { useRowAction } from "@/components/useRowAction";
import { Alert, Button, Card, CardHeader, EmptyState, BoxIcon, PageHeader, Spinner } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { categoryLabel, conditionLabel } from "@/lib/format";

export function ListingsScreen() {
  const tools = useQuery(api.tools.mine);
  const create = useMutation(api.tools.create);
  const update = useMutation(api.tools.update);
  const remove = useMutation(api.tools.remove);
  const [editing, setEditing] = useState<Id<"tools">>();
  const [confirming, setConfirming] = useState<Id<"tools">>();
  const { run, errorFor } = useRowAction();

  return (
    <>
      <PageHeader title="My listings" description="Tools you're lending to the neighbourhood." />
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-3" aria-label="Your tools">
          {tools === undefined ? (
            <Spinner />
          ) : tools.length === 0 ? (
            <EmptyState icon={<BoxIcon />} title="You haven't listed anything yet" description="Use the form to add your first tool." />
          ) : (
            <ul className="space-y-3">
              {tools.map((tool) => (
                <Card as="li" key={tool._id}>
                  {editing === tool._id ? (
                    <ToolForm
                      initial={{ name: tool.name, category: tool.category, condition: tool.condition, description: tool.description }}
                      submitLabel="Save"
                      onCancel={() => setEditing(undefined)}
                      onSubmit={async (fields) => {
                        await update({ toolId: tool._id, ...fields });
                        setEditing(undefined);
                      }}
                    />
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="text-subtitle-semibold text-fg">{tool.name}</h2>
                          <p className="mt-1 text-description text-fg-muted">
                            {categoryLabel(tool.category)} · {conditionLabel(tool.condition)}
                          </p>
                        </div>
                        <ToolStatusBadge status={tool.status} />
                      </div>
                      {tool.description && <p className="mt-3 text-body text-fg">{tool.description}</p>}
                      {confirming === tool._id ? (
                        <div role="group" aria-label={`Delete ${tool.name}?`} className="mt-4 flex flex-wrap items-center gap-2">
                          <span className="text-body text-fg">Delete this listing? Open requests will be declined.</span>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              setConfirming(undefined);
                              void run(tool._id, () => remove({ toolId: tool._id }));
                            }}
                          >
                            Confirm delete
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setConfirming(undefined)}>Keep</Button>
                        </div>
                      ) : (
                        <div className="mt-4 flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setEditing(tool._id)}>Edit</Button>
                          <Button variant="danger" size="sm" onClick={() => setConfirming(tool._id)}>Delete</Button>
                        </div>
                      )}
                      {errorFor(tool._id) && <Alert tone="danger" className="mt-3">{errorFor(tool._id)}</Alert>}
                    </>
                  )}
                </Card>
              ))}
            </ul>
          )}
        </section>
        <Card as="section" aria-labelledby="new-listing">
          <CardHeader title={<span id="new-listing">List a tool</span>} description="It appears on the board straight away." />
          <ToolForm submitLabel="List it" onSubmit={(fields) => create(fields)} />
        </Card>
      </div>
    </>
  );
}

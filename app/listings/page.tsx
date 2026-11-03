"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { ToolForm } from "@/components/ToolForm";
import { Badge, Empty, ErrorText, Loading, PageHeader } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { categoryLabel, conditionLabel, errorMessage } from "@/lib/format";

export default function ListingsPage() {
  const tools = useQuery(api.tools.mine);
  const create = useMutation(api.tools.create);
  const update = useMutation(api.tools.update);
  const remove = useMutation(api.tools.remove);
  const [editing, setEditing] = useState<Id<"tools">>();
  const [error, setError] = useState<{ id: Id<"tools">; message: string }>();

  return (
    <>
      <PageHeader title="My listings" />
      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <section className="space-y-3">
          {tools === undefined ? (
            <Loading />
          ) : tools.length === 0 ? (
            <Empty>You haven&apos;t listed anything yet.</Empty>
          ) : (
            tools.map((tool) => (
              <article key={tool._id} className="card">
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
                        <h2 className="font-medium">{tool.name}</h2>
                        <p className="text-xs text-muted">
                          {categoryLabel(tool.category)} · {conditionLabel(tool.condition)}
                        </p>
                      </div>
                      {tool.status === "available" ? <Badge tone="good">Available</Badge> : <Badge tone="warn">On loan</Badge>}
                    </div>
                    {tool.description && <p className="mt-2 text-sm">{tool.description}</p>}
                    <div className="mt-3 flex gap-2">
                      <button className="btn-ghost" onClick={() => setEditing(tool._id)}>Edit</button>
                      <button
                        className="btn-danger"
                        onClick={async () => {
                          setError(undefined);
                          try {
                            await remove({ toolId: tool._id });
                          } catch (err) {
                            setError({ id: tool._id, message: errorMessage(err) });
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                    {error?.id === tool._id && <div className="mt-2"><ErrorText>{error.message}</ErrorText></div>}
                  </>
                )}
              </article>
            ))
          )}
        </section>
        <aside className="card h-fit">
          <h2 className="mb-3 font-medium">List a tool</h2>
          <ToolForm submitLabel="List it" onSubmit={(fields) => create(fields)} />
        </aside>
      </div>
    </>
  );
}

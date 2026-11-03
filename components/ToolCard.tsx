"use client";

import type { ReactNode } from "react";
import { CategoryBadge } from "@/components/CategoryBadge";
import { ToolImage } from "@/components/ToolImage";
import { ToolStatusBadge } from "@/components/ToolStatusBadge";
import { Avatar, Badge, ShieldIcon } from "@/components/ui";
import type { Doc } from "@/convex/_generated/dataModel";
import { conditionLabel } from "@/lib/format";

export type BoardTool = {
  _id: string;
  name: string;
  category: Doc<"tools">["category"];
  condition: Doc<"tools">["condition"];
  description: string;
  status: Doc<"tools">["status"];
  imageUrl: string | null;
  isMine: boolean;
  lenderName: string;
  trustedLender: boolean;
};

/**
 * One tool on the board: photo (or category tile) with the status on top,
 * name, category and condition, a two-line description, then who lends it and
 * the action. Equal height in a grid; the action sits on the bottom edge.
 */
export function ToolCard({ tool, action, children }: { tool: BoardTool; action: ReactNode; children?: ReactNode }) {
  return (
    <li className="flex min-w-0 flex-col [overflow-wrap:anywhere] rounded-lg border border-line bg-surface">
      <div className="relative overflow-hidden rounded-t-lg">
        <ToolImage src={tool.imageUrl} name={tool.name} category={tool.category} />
        <ToolStatusBadge status={tool.status} className="absolute top-3 left-3 shadow-sm" />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h2 className="text-subtitle-semibold text-fg">{tool.name}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <CategoryBadge category={tool.category} />
          <span className="text-description text-fg-muted">{conditionLabel(tool.condition)}</span>
        </div>
        {tool.description && <p className="mt-3 line-clamp-2 text-body text-fg-muted">{tool.description}</p>}
        <div className="mt-auto pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <Avatar name={tool.isMine ? "You" : tool.lenderName} size={28} />
              <span className="truncate text-description text-fg-muted">
                {tool.isMine ? "Your listing" : <>Lent by <span className="font-semibold text-fg">{tool.lenderName}</span></>}
              </span>
              {tool.trustedLender && (
                <Badge tone="brand" className="gap-1" title="Trusted lender">
                  <ShieldIcon size={13} />
                  Trusted lender
                </Badge>
              )}
            </span>
            {action}
          </div>
          {children}
        </div>
      </div>
    </li>
  );
}

/** Tiles view: a dense photo grid; name, category and status, the action on hover/focus row. */
export function ToolTile({ tool, action, children }: { tool: BoardTool; action: ReactNode; children?: ReactNode }) {
  return (
    <li className="flex min-w-0 flex-col [overflow-wrap:anywhere] rounded-lg border border-line bg-surface">
      <div className="relative overflow-hidden rounded-t-lg">
        <ToolImage src={tool.imageUrl} name={tool.name} category={tool.category} iconSize={28} className="aspect-square" />
        <ToolStatusBadge status={tool.status} className="absolute top-2 left-2 shadow-sm" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <h2 className="line-clamp-2 text-body-bold text-fg">{tool.name}</h2>
        <CategoryBadge category={tool.category} className="self-start" />
        <p className="truncate text-description text-fg-muted">{tool.isMine ? "Your listing" : `Lent by ${tool.lenderName}`}</p>
        {action && <div className="mt-auto pt-1 [&>button]:w-full">{action}</div>}
        {children}
      </div>
    </li>
  );
}

/** List view: one compact row per tool, scannable like a table. */
export function ToolRow({ tool, action, children }: { tool: BoardTool; action: ReactNode; children?: ReactNode }) {
  return (
    <li className="rounded-lg border border-line bg-surface p-3">
      <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-x-4 gap-y-2 sm:flex sm:flex-wrap">
        <ToolImage src={tool.imageUrl} name={tool.name} category={tool.category} iconSize={20} className="w-16 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-body-bold text-fg">{tool.name}</h2>
          <p className="mt-0.5 truncate text-description text-fg-muted">
            {conditionLabel(tool.condition)} · {tool.isMine ? "Your listing" : `Lent by ${tool.lenderName}`}
            {tool.trustedLender && " · Trusted lender"}
          </p>
        </div>
        <CategoryBadge category={tool.category} className="hidden sm:inline-flex" />
        <ToolStatusBadge status={tool.status} />
        <div className="ml-auto justify-self-end">{action}</div>
      </div>
      {children}
    </li>
  );
}

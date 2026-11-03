"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { errorMessage, todayIso } from "@/lib/format";
import { ErrorText } from "./ui";

export function BorrowForm({
  toolId,
  onSent,
  onCancel,
}: {
  toolId: Id<"tools">;
  onSent: () => void;
  onCancel: () => void;
}) {
  const request = useMutation(api.loans.request);
  const [startDate, setStart] = useState(todayIso(1));
  const [endDate, setEnd] = useState(todayIso(3));
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  return (
    <form
      className="mt-3 space-y-3 border-t border-border pt-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(undefined);
        try {
          await request({ toolId, startDate, endDate });
          onSent();
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <label>
          <span className="label">From</span>
          <input type="date" className="field" required min={todayIso()} value={startDate}
            onChange={(e) => setStart(e.target.value)} />
        </label>
        <label>
          <span className="label">Until</span>
          <input type="date" className="field" required min={startDate} value={endDate}
            onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>Send request</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

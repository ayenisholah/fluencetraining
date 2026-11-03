"use client";

import { useMutation } from "convex/react";
import { useId, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { loanDateError, MAX_LOAN_DAYS } from "@/convex/lib/rules";
import { errorMessage, todayIso } from "@/lib/format";
import { ErrorText, FieldError } from "./ui";

export function BorrowForm({
  toolId,
  onSent,
  onCancel,
}: {
  toolId: Id<"tools">;
  onSent: () => void;
  onCancel: () => void;
}) {
  const id = useId();
  const request = useMutation(api.loans.request);
  const [startDate, setStart] = useState(todayIso(1));
  const [endDate, setEnd] = useState(todayIso(3));
  const [interacted, setInteracted] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const dateError = loanDateError(startDate, endDate);
  const shownDateError = interacted ? dateError : undefined;
  const describedBy = `${id}-hint${shownDateError ? ` ${id}-error` : ""}`;

  return (
    <form
      className="mt-3 space-y-3 border-t border-border pt-3"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setInteracted(true);
        if (dateError) return;
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
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="sr-only">Borrowing dates</legend>
        <div>
          <label htmlFor={`${id}-from`} className="label">From</label>
          <input id={`${id}-from`} type="date" className="field" min={todayIso()} value={startDate}
            aria-invalid={shownDateError ? true : undefined} aria-describedby={describedBy}
            onChange={(e) => { setStart(e.target.value); setInteracted(true); }} />
        </div>
        <div>
          <label htmlFor={`${id}-until`} className="label">Until</label>
          <input id={`${id}-until`} type="date" className="field" min={startDate} value={endDate}
            aria-invalid={shownDateError ? true : undefined} aria-describedby={describedBy}
            onChange={(e) => { setEnd(e.target.value); setInteracted(true); }} />
        </div>
      </fieldset>
      <p id={`${id}-hint`} className="text-xs text-muted">Up to {MAX_LOAN_DAYS} days.</p>
      <FieldError id={`${id}-error`}>{shownDateError}</FieldError>
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>
          {pending ? "Sending…" : "Send request"}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

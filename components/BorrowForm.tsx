"use client";

import { useState } from "react";
import { Alert, Button, TextField } from "@/components/ui";
import { loanDateError, MAX_LOAN_DAYS } from "@/convex/lib/rules";
import { errorMessage, todayIso } from "@/lib/format";

/** Which date field a range error belongs to, so the message sits under it. */
export function dateErrorField(message: string, startDate: string): "from" | "until" {
  if (/start/i.test(message)) return "from";
  if (/both/i.test(message) && !startDate) return "from";
  return "until";
}

export function BorrowForm({
  onSubmit,
  onSent,
  onCancel,
}: {
  onSubmit: (dates: { startDate: string; endDate: string }) => Promise<unknown>;
  onSent: () => void;
  onCancel: () => void;
}) {
  const [startDate, setStart] = useState(todayIso(1));
  const [endDate, setEnd] = useState(todayIso(3));
  const [interacted, setInteracted] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const dateError = loanDateError(startDate, endDate);
  const shown = interacted ? dateError : undefined;
  const field = shown ? dateErrorField(shown, startDate) : undefined;

  return (
    <form
      className="mt-4 space-y-3 border-t border-line pt-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setInteracted(true);
        if (dateError) return;
        setPending(true);
        setError(undefined);
        try {
          await onSubmit({ startDate, endDate });
          onSent();
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setPending(false);
        }
      }}
    >
      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="sr-only">Borrowing dates</legend>
        <TextField
          type="date"
          label="From"
          min={todayIso()}
          value={startDate}
          error={field === "from" ? shown : undefined}
          onChange={(e) => {
            setStart(e.target.value);
            setInteracted(true);
          }}
        />
        <TextField
          type="date"
          label="Until"
          min={startDate}
          value={endDate}
          hint={`Up to ${MAX_LOAN_DAYS} days.`}
          error={field === "until" ? shown : undefined}
          onChange={(e) => {
            setEnd(e.target.value);
            setInteracted(true);
          }}
        />
      </fieldset>
      <Alert tone="danger">{error}</Alert>
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={pending}>
          Send request
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

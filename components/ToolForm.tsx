"use client";

import { useState } from "react";
import { CATEGORIES, CONDITIONS, errorMessage, type Category, type Condition } from "@/lib/format";
import { ErrorText } from "./ui";

export type ToolFields = {
  name: string;
  category: Category;
  condition: Condition;
  description: string;
};

const empty: ToolFields = { name: "", category: "power_tools", condition: "good", description: "" };

export function ToolForm({
  initial = empty,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: ToolFields;
  submitLabel: string;
  onSubmit: (fields: ToolFields) => Promise<unknown>;
  onCancel?: () => void;
}) {
  const [fields, setFields] = useState(initial);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const set = <K extends keyof ToolFields>(key: K, value: ToolFields[K]) =>
    setFields((f) => ({ ...f, [key]: value }));

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(undefined);
        try {
          await onSubmit(fields);
          if (initial === empty) setFields(empty);
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setPending(false);
        }
      }}
    >
      <label className="block">
        <span className="label">Name</span>
        <input className="field" required minLength={2} maxLength={80} value={fields.name}
          onChange={(e) => set("name", e.target.value)} placeholder="e.g. Cordless drill" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label>
          <span className="label">Category</span>
          <select className="field" value={fields.category}
            onChange={(e) => set("category", e.target.value as Category)}>
            {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label>
          <span className="label">Condition</span>
          <select className="field" value={fields.condition}
            onChange={(e) => set("condition", e.target.value as Condition)}>
            {CONDITIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="label">Short description</span>
        <textarea className="field" rows={3} maxLength={500} value={fields.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="What's included, anything borrowers should know" />
      </label>
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>{submitLabel}</button>
        {onCancel && <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

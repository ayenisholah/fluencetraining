"use client";

import { useRef, useState } from "react";
import { Alert, Button, Select, TextField } from "@/components/ui";
import { TOOL_DESCRIPTION_MAX, TOOL_NAME_MAX, toolFieldErrors } from "@/convex/lib/rules";
import { CATEGORIES, CONDITIONS, errorMessage, type Category, type Condition } from "@/lib/format";

export type ToolFields = {
  name: string;
  category: Category;
  condition: Condition;
  description: string;
};

export const emptyTool: ToolFields = { name: "", category: "power_tools", condition: "good", description: "" };

const categoryOptions = CATEGORIES.map(([value, label]) => ({ value, label }));
const conditionOptions = CONDITIONS.map(([value, label]) => ({ value, label }));

export function ToolForm({
  initial = emptyTool,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: ToolFields;
  submitLabel: string;
  onSubmit: (fields: ToolFields) => Promise<unknown>;
  onCancel?: () => void;
}) {
  const nameRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const [fields, setFields] = useState(initial);
  const [touched, setTouched] = useState<{ name?: boolean; description?: boolean }>({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const set = <K extends keyof ToolFields>(key: K, value: ToolFields[K]) =>
    setFields((f) => ({ ...f, [key]: value }));

  const errors = toolFieldErrors(fields);
  const show = (field: "name" | "description") => (touched[field] || submitted ? errors[field] : undefined);

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setSubmitted(true);
        if (errors.name) return nameRef.current?.focus();
        if (errors.description) return descriptionRef.current?.focus();
        setPending(true);
        setError(undefined);
        try {
          await onSubmit(fields);
          if (initial === emptyTool) {
            setFields(emptyTool);
            setTouched({});
            setSubmitted(false);
          }
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setPending(false);
        }
      }}
    >
      <TextField
        ref={nameRef}
        label="Name"
        placeholder="e.g. Cordless drill"
        maxLength={TOOL_NAME_MAX}
        value={fields.name}
        error={show("name")}
        onChange={(e) => set("name", e.target.value)}
        onBlur={() => setTouched((t) => ({ ...t, name: true }))}
      />
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Category"
          options={categoryOptions}
          value={fields.category}
          onValueChange={(v) => set("category", v as Category)}
        />
        <Select
          label="Condition"
          options={conditionOptions}
          value={fields.condition}
          onValueChange={(v) => set("condition", v as Condition)}
        />
      </div>
      <TextField
        ref={descriptionRef}
        multiline
        label="Short description"
        placeholder="What's included, anything borrowers should know"
        maxLengthHint={TOOL_DESCRIPTION_MAX}
        value={fields.description}
        error={show("description")}
        onChange={(e) => set("description", e.target.value)}
        onBlur={() => setTouched((t) => ({ ...t, description: true }))}
      />
      <Alert tone="danger">{error}</Alert>
      <div className="flex gap-2">
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

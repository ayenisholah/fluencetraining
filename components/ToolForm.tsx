"use client";

import { useId, useRef, useState } from "react";
import {
  TOOL_DESCRIPTION_MAX,
  TOOL_NAME_MAX,
  toolFieldErrors,
} from "@/convex/lib/rules";
import { CATEGORIES, CONDITIONS, errorMessage, type Category, type Condition } from "@/lib/format";
import { ErrorText, FieldError } from "./ui";

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
  const id = useId();
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
  const show = (field: "name" | "description") =>
    (touched[field] || submitted) ? errors[field] : undefined;
  const nameError = show("name");
  const descriptionError = show("description");

  return (
    <form
      className="space-y-3"
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
          if (initial === empty) {
            setFields(empty);
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
      <div>
        <label htmlFor={`${id}-name`} className="label">Name</label>
        <input
          id={`${id}-name`}
          ref={nameRef}
          className="field"
          maxLength={TOOL_NAME_MAX}
          value={fields.name}
          placeholder="e.g. Cordless drill"
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? `${id}-name-error` : undefined}
          onChange={(e) => set("name", e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, name: true }))}
        />
        <FieldError id={`${id}-name-error`}>{nameError}</FieldError>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={`${id}-category`} className="label">Category</label>
          <select id={`${id}-category`} className="field" value={fields.category}
            onChange={(e) => set("category", e.target.value as Category)}>
            {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-condition`} className="label">Condition</label>
          <select id={`${id}-condition`} className="field" value={fields.condition}
            onChange={(e) => set("condition", e.target.value as Condition)}>
            {CONDITIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor={`${id}-description`} className="label">Short description</label>
          <span
            id={`${id}-description-count`}
            className={`text-xs ${fields.description.length > TOOL_DESCRIPTION_MAX ? "text-danger" : "text-muted"}`}
          >
            {fields.description.length}/{TOOL_DESCRIPTION_MAX}
          </span>
        </div>
        <textarea
          id={`${id}-description`}
          ref={descriptionRef}
          className="field"
          rows={3}
          value={fields.description}
          placeholder="What's included, anything borrowers should know"
          aria-invalid={descriptionError ? true : undefined}
          aria-describedby={`${id}-description-count${descriptionError ? ` ${id}-description-error` : ""}`}
          onChange={(e) => set("description", e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, description: true }))}
        />
        <FieldError id={`${id}-description-error`}>{descriptionError}</FieldError>
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
        {onCancel && <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

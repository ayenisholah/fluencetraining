"use client";

import { useRef, useState } from "react";
import { Alert, Button, Select, TextField } from "@/components/ui";
import { TOOL_DESCRIPTION_MAX, TOOL_NAME_MAX, toolFieldErrors } from "@/convex/lib/rules";
import { CATEGORIES, CONDITIONS, errorMessage, type Category, type Condition } from "@/lib/format";
import { PhotoPicker, type PhotoValue } from "./PhotoPicker";

export type ToolFields = {
  name: string;
  category: Category;
  condition: Condition;
  description: string;
};

export const emptyTool: ToolFields = { name: "", category: "power_tools", condition: "good", description: "" };

/** What the form hands back: the fields plus what to do with the photo. */
export type ToolSubmit = ToolFields & { imageId?: string; removeImage?: boolean };

const categoryOptions = CATEGORIES.map(([value, label]) => ({ value, label }));
const conditionOptions = CONDITIONS.map(([value, label]) => ({ value, label }));

export function ToolForm({
  initial = emptyTool,
  initialImageUrl,
  submitLabel,
  onSubmit,
  onCancel,
  uploadImage,
}: {
  initial?: ToolFields;
  /** The listing's current photo, when editing. */
  initialImageUrl?: string | null;
  submitLabel: string;
  onSubmit: (fields: ToolSubmit) => Promise<unknown>;
  onCancel?: () => void;
  /** Uploads a chosen photo and resolves to its storage id. Without it, no photo picker. */
  uploadImage?: (file: File) => Promise<string>;
}) {
  const nameRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const [fields, setFields] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const startPhoto: PhotoValue = initialImageUrl ? { kind: "existing", url: initialImageUrl } : { kind: "none" };
  const [photo, setPhoto] = useState<PhotoValue>(startPhoto);
  const set = <K extends keyof ToolFields>(key: K, value: ToolFields[K]) =>
    setFields((f) => ({ ...f, [key]: value }));

  const errors = toolFieldErrors(fields);
  // Errors appear only once the user tries to submit, then update live as they
  // fix the field. Typing into or leaving a field never shows one by itself.
  const show = (field: "name" | "description") => (submitted ? errors[field] : undefined);

  return (
    <form
      className="@container space-y-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setSubmitted(true);
        if (errors.name) return nameRef.current?.focus();
        if (errors.description) return descriptionRef.current?.focus();
        setPending(true);
        setError(undefined);
        try {
          // Upload first so a failed upload leaves the listing untouched.
          const imageId = photo.kind === "new" && uploadImage ? await uploadImage(photo.file) : undefined;
          const removeImage = Boolean(initialImageUrl) && photo.kind === "none";
          await onSubmit({ ...fields, ...(imageId ? { imageId } : {}), ...(removeImage ? { removeImage } : {}) });
          if (initial === emptyTool) {
            setFields(emptyTool);
            setPhoto({ kind: "none" });
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
      />
      <div className="grid grid-cols-1 gap-3 @[24rem]:grid-cols-2">
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
      />
      {uploadImage && <PhotoPicker value={photo} onChange={setPhoto} />}
      <Alert tone="danger">{error}</Alert>
      <div className="flex flex-wrap gap-2">
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

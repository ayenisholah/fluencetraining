"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button, ImageIcon, UploadIcon } from "@/components/ui";
import { cn } from "@/lib/cn";

// Mirrors convex/lib/images.ts (the server re-checks; this is instant feedback).
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export type PhotoValue =
  | { kind: "none" }
  | { kind: "existing"; url: string }
  | { kind: "new"; file: File };

export function photoError(file: File): string | undefined {
  if (!PHOTO_TYPES.includes(file.type)) return "Choose a JPEG, PNG or WebP image.";
  if (file.size > PHOTO_MAX_BYTES) return "Photos must be 5 MB or smaller.";
  return undefined;
}

/**
 * Optional tool photo: a drop zone or button to choose one, a preview, and
 * Replace / Remove. Controlled by the form; the upload happens on submit.
 */
export function PhotoPicker({ value, onChange }: { value: PhotoValue; onChange: (value: PhotoValue) => void }) {
  const inputId = useId();
  const errorId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();
  const [dragging, setDragging] = useState(false);
  // Object URL for a local preview; revoked when the file changes or on unmount.
  const preview = useMemo(() => (value.kind === "new" ? URL.createObjectURL(value.file) : undefined), [value]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const pick = (file: File | undefined) => {
    if (!file) return;
    const problem = photoError(file);
    setError(problem);
    if (!problem) onChange({ kind: "new", file });
    if (input.current) input.current.value = "";
  };
  const src = value.kind === "existing" ? value.url : preview;

  return (
    <div>
      <span className="text-description font-medium text-fg-muted">Photo (optional)</span>
      <input
        ref={input}
        id={inputId}
        type="file"
        accept={PHOTO_TYPES.join(",")}
        className="sr-only"
        aria-describedby={error ? errorId : undefined}
        aria-label={src ? "Replace photo" : "Choose a photo"}
        onChange={(e) => pick(e.target.files?.[0])}
      />
      {src ? (
        <div className="mt-2 flex flex-wrap items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview or Convex storage URL */}
          <img src={src} alt="Selected photo" className="size-24 rounded-md border border-line object-cover" />
          <div className="flex flex-col gap-2">
            <Button variant="ghost" size="sm" onClick={() => input.current?.click()}>
              Replace
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setError(undefined);
                onChange({ kind: "none" });
              }}
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "mt-2 flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed px-4 py-6 text-center text-description text-fg-muted transition-colors",
            dragging ? "border-brand bg-brand-soft" : "border-line-strong hover:border-brand",
          )}
        >
          {dragging ? <ImageIcon size={24} className="text-brand-fg" /> : <UploadIcon size={24} className="text-brand-fg" />}
          <span>
            <span className="font-semibold text-brand-fg">Choose a photo</span> or drop it here
          </span>
          <span>JPEG, PNG or WebP, up to 5 MB</span>
        </label>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-description text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

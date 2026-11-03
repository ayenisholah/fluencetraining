"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/format";
import { Alert } from "../Alert/Alert";
import { Button } from "../Button/Button";
import { WarningIcon } from "../icons";

export type ConfirmOptions = {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "brand";
  /** The action. A rejection keeps the dialog open and shows the message. */
  onConfirm: () => Promise<unknown>;
};

/**
 * Modal confirmation built on the native <dialog> (showModal): the browser
 * provides focus trapping, an inert background, Escape and the top layer.
 * Focus starts on the safe button and returns to the trigger afterwards.
 */
export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  cancelLabel = "Keep",
  tone = "danger",
  onConfirm,
}: ConfirmOptions & { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<Element | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnTo.current = document.activeElement;
      setError(undefined);
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const finish = useCallback(() => {
    onClose();
    (returnTo.current as HTMLElement | null)?.focus?.();
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      // Escape: let our state drive closing (and refocus the trigger).
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) finish();
      }}
      // A click on the backdrop lands on the <dialog> element itself.
      onClick={(e) => {
        if (e.target === ref.current && !pending) finish();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] overflow-y-auto [overflow-wrap:anywhere] w-[calc(100%-2rem)] max-w-[420px] rounded-lg border border-line bg-surface p-0 text-fg shadow-popover backdrop:bg-neutral-1000/40 backdrop:backdrop-blur-[2px] motion-safe:open:animate-[dialog-in_150ms_ease-out]"
    >
      <div className="p-6">
        <div className="flex gap-4">
          <span
            aria-hidden
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-full",
              tone === "danger" ? "bg-danger-soft text-danger" : "bg-brand-soft text-brand-fg",
            )}
          >
            <WarningIcon size={22} />
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="text-subtitle-semibold text-fg">
              {title}
            </h2>
            <div id={descriptionId} className="mt-1.5 text-body text-fg-muted">
              {description}
            </div>
          </div>
        </div>
        {error && (
          <Alert tone="danger" className="mt-4">
            {error}
          </Alert>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button ref={cancelRef} variant="ghost" onClick={finish} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "solid"}
            loading={pending}
            onClick={async () => {
              setPending(true);
              setError(undefined);
              try {
                await onConfirm();
                finish();
              } catch (err) {
                setError(errorMessage(err));
              } finally {
                setPending(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}

/**
 * `const { confirm, dialog } = useConfirm();` then render `{dialog}` once and
 * call `confirm({ title, description, confirmLabel, onConfirm })` from a click.
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions>();
  const [open, setOpen] = useState(false);
  const confirm = useCallback((next: ConfirmOptions) => {
    setOptions(next);
    setOpen(true);
  }, []);
  const dialog = options ? <ConfirmDialog {...options} open={open} onClose={() => setOpen(false)} /> : null;
  return { confirm, dialog };
}

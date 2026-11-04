"use client";

import {
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";
import { describedBy, FieldShell } from "./FieldShell";

type Common = {
  label: string;
  hint?: ReactNode;
  /** Shown in the red caption bar; also sets aria-invalid. */
  error?: ReactNode;
  /** Show a "n/max" counter (does not truncate input). */
  maxLengthHint?: number;
  className?: string;
};

export type TextFieldProps = Common & Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & { multiline?: false };
export type TextAreaFieldProps = Common &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & { multiline: true };

const inputClass =
  "w-full bg-transparent px-4 text-body text-fg outline-none placeholder:text-field-placeholder disabled:cursor-not-allowed";

/**
 * Text input with a floating label (Figma "Fields"). The label sits inside
 * the field at rest and moves up when the field is focused or has a value.
 */
export const TextField = forwardRef<HTMLInputElement | HTMLTextAreaElement, TextFieldProps | TextAreaFieldProps>(
  function TextField(props, ref) {
    // `multiline` is ours, not a DOM attribute: keep it out of `rest`.

    const { label, hint, error, maxLengthHint, className, id: idProp, multiline: _multiline, ...rest } = props;
    const autoId = useId();
    const id = idProp ?? autoId;
    const [focused, setFocused] = useState(false);
    const [uncontrolledLength, setUncontrolledLength] = useState(String(rest.defaultValue ?? "").length);
    const valueLength = rest.value !== undefined ? String(rest.value).length : uncontrolledLength;
    const isDate = !props.multiline && (props.type === "date" || props.type === "time");
    const floating = focused || valueLength > 0 || Boolean(rest.placeholder) || props.multiline || isDate;
    const invalid = Boolean(error) || rest["aria-invalid"] === true;
    const counter = maxLengthHint !== undefined ? { length: valueLength, max: maxLengthHint } : undefined;

    const shared = {
      id,
      "aria-invalid": invalid || undefined,
      "aria-describedby": describedBy(id, { hint, error, counter }),
      onFocus: (e: React.FocusEvent<HTMLInputElement & HTMLTextAreaElement>) => {
        setFocused(true);
        rest.onFocus?.(e as never);
      },
      onBlur: (e: React.FocusEvent<HTMLInputElement & HTMLTextAreaElement>) => {
        setFocused(false);
        rest.onBlur?.(e as never);
      },
      onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => {
        setUncontrolledLength(e.target.value.length);
        rest.onChange?.(e as never);
      },
    };

    return (
      <FieldShell id={id} hint={hint} error={error} counter={counter} invalid={invalid} className={className}>
        <label
          htmlFor={id}
          className={cn(
            "pointer-events-none absolute left-4 text-field-label transition-all",
            floating ? "top-1.5 text-description" : "top-1/2 -translate-y-1/2 text-body",
          )}
        >
          {label}
        </label>
        {props.multiline ? (
          <textarea
            ref={ref as React.Ref<HTMLTextAreaElement>}
            rows={3}
            {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
            {...shared}
            className={cn(inputClass, "block resize-y pt-6 pb-2")}
          />
        ) : (
          <input
            ref={ref as React.Ref<HTMLInputElement>}
            {...(rest as InputHTMLAttributes<HTMLInputElement>)}
            {...shared}
            className={cn(inputClass, "h-12 pt-4")}
          />
        )}
      </FieldShell>
    );
  },
);

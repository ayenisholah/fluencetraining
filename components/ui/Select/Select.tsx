import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { ChevronDownIcon } from "../icons";
import { describedBy, FieldShell } from "../TextField/FieldShell";

export type SelectOption = { value: string; label: string };

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> & {
  label: string;
  options: readonly SelectOption[];
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
};

/** Native select in the field style, with the label always floated. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, options, hint, error, className, id: idProp, ...props },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const invalid = Boolean(error);
  return (
    <FieldShell id={id} hint={hint} error={error} invalid={invalid} className={className}>
      <label htmlFor={id} className="pointer-events-none absolute top-1.5 left-4 text-description text-field-label">
        {label}
      </label>
      <select
        ref={ref}
        id={id}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy(id, { hint, error })}
        className={cn(
          "h-12 w-full appearance-none bg-transparent pt-4 pr-10 pl-4 text-body text-fg outline-none disabled:cursor-not-allowed",
        )}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon size={18} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-fg-subtle" />
    </FieldShell>
  );
});

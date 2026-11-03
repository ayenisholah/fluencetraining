import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type ChoiceProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: ReactNode };

const box =
  "peer size-5 shrink-0 appearance-none border border-line-strong bg-surface outline-none transition-colors checked:border-brand checked:bg-brand focus-visible:ring-4 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50";

/** 20×20 checkbox (Figma "Selectors"). Native input, so forms and keyboard just work. */
export const Checkbox = forwardRef<HTMLInputElement, ChoiceProps>(function Checkbox(
  { label, className, id: idProp, ...props },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="relative inline-flex">
        <input ref={ref} id={id} type="checkbox" className={cn(box, "rounded-[5px]")} {...props} />
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className="pointer-events-none absolute inset-0 hidden text-white peer-checked:block"
        >
          <path d="m5.5 10.5 3 3 6-6.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <label htmlFor={id} className="text-body text-fg">
        {label}
      </label>
    </span>
  );
});

/** 20×20 radio. Group several with the same `name` inside a <fieldset>. */
export const Radio = forwardRef<HTMLInputElement, ChoiceProps>(function Radio(
  { label, className, id: idProp, ...props },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="relative inline-flex">
        <input ref={ref} id={id} type="radio" className={cn(box, "rounded-full")} {...props} />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-[6px] hidden rounded-full bg-white peer-checked:block"
        />
      </span>
      <label htmlFor={id} className="text-body text-fg">
        {label}
      </label>
    </span>
  );
});

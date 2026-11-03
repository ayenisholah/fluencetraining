"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import { popoverCardClass } from "../Popover/usePopover";

export type DropdownItem = {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  /** Render as a link. */
  href?: string;
  onSelect?: () => void;
  active?: boolean;
  /** Destructive action: red, as in Figma's "Cancel" / "Delete". */
  tone?: "default" | "danger";
  /** Draw a divider above this item. */
  separatorBefore?: boolean;
};

type LinkLike = ComponentType<{
  href: string;
  className?: string;
  role?: string;
  tabIndex?: number;
  onClick?: () => void;
  children: ReactNode;
  ref?: React.Ref<HTMLAnchorElement>;
  "aria-current"?: "page";
}>;

export type DropdownMenuProps = {
  /** Content of the trigger button. */
  trigger: ReactNode;
  /** Accessible name for the trigger when it's icon-only. */
  triggerLabel: string;
  items: DropdownItem[];
  align?: "start" | "end";
  triggerClassName?: string;
  /** e.g. next/link. Defaults to a plain <a>. */
  linkComponent?: LinkLike;
};

const itemClass =
  "flex h-[46px] w-full items-center gap-3 rounded-sm px-4 text-left text-body font-medium text-fg-muted outline-none hover:bg-surface-sunken hover:text-fg focus:bg-surface-sunken focus:text-fg [&_svg]:size-5";

/**
 * Menu button (Figma "Dropdown item"). Implements the WAI-ARIA menu pattern:
 * Enter/Space/ArrowDown open and focus the first item, arrows/Home/End move,
 * Escape and outside clicks close and return focus to the trigger.
 */
export function DropdownMenu({
  trigger,
  triggerLabel,
  items,
  align = "end",
  triggerClassName,
  linkComponent,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const Link = (linkComponent ?? "a") as unknown as LinkLike;

  const focusItem = (i: number) => {
    const n = items.length;
    itemRefs.current[((i % n) + n) % n]?.focus();
  };

  const close = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    focusItem(0);
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when the menu opens
  }, [open]);

  const onTriggerKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onMenuKey = (e: KeyboardEvent) => {
    const current = itemRefs.current.findIndex((el) => el === document.activeElement);
    const moves: Record<string, number> = {
      ArrowDown: current + 1,
      ArrowUp: current - 1,
      Home: 0,
      End: items.length - 1,
    };
    if (e.key in moves) {
      e.preventDefault();
      focusItem(moves[e.key]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      close(false);
    }
  };

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={triggerLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKey}
        className={cn(
          "inline-flex items-center gap-2 rounded-pill outline-none focus-visible:ring-4 focus-visible:ring-focus-ring",
          triggerClassName,
        )}
      >
        {trigger}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={triggerLabel}
          onKeyDown={onMenuKey}
          className={cn(popoverCardClass, "mt-2 min-w-[187px] p-1.5", align === "end" ? "right-0" : "left-0")}
        >
          {items.map((item, i) => {
            const content = (
              <>
                {item.icon}
                <span>{item.label}</span>
              </>
            );
            const select = () => {
              item.onSelect?.();
              close(!item.href);
            };
            const cls = cn(
              itemClass,
              item.active && "bg-surface-sunken text-fg",
              item.tone === "danger" && "text-danger hover:text-danger focus:text-danger",
            );
            const divider = item.separatorBefore ? (
              <div key={`${item.key}-sep`} role="separator" className="mx-3 my-1 h-px bg-line" />
            ) : null;
            return [divider, item.href ? (
              <Link
                key={item.key}
                ref={(el: HTMLAnchorElement | null) => {
                  itemRefs.current[i] = el;
                }}
                href={item.href}
                role="menuitem"
                tabIndex={-1}
                onClick={select}
                aria-current={item.active ? "page" : undefined}
                className={cls}
              >
                {content}
              </Link>
            ) : (
              <button
                key={item.key}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={select}
                className={cls}
              >
                {content}
              </button>
            )];
          })}
        </div>
      )}
    </div>
  );
}

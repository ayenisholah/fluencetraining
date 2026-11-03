// Stroke icons in the style of the Vuesax "linear" set (24px, 1.5 stroke,
// currentColor). Decorative by default; pass `title` to make one meaningful.
import type { SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement> & { size?: number; title?: string };

function Icon({ size = 24, title, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      focusable="false"
      {...props}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

export const HomeIcon = (p: IconProps) => (
  <Icon {...p}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></Icon>
);
export const BoxIcon = (p: IconProps) => (
  <Icon {...p}><path d="m3.5 7.5 8.5-4.5 8.5 4.5v9L12 21l-8.5-4.5z" /><path d="m3.5 7.5 8.5 4.5 8.5-4.5M12 12v9" /></Icon>
);
export const ToolIcon = (p: IconProps) => (
  <Icon {...p}><path d="M14.5 6.5a4 4 0 0 0 5 5L21 13l-8 8-3-3 6.5-6.5M14.5 6.5 9 1 6 4l5.5 5.5" /><path d="m3 21 6-6" /></Icon>
);
export const SendIcon = (p: IconProps) => (
  <Icon {...p}><path d="M21 3 10 14M21 3l-7 18-4-7-7-4z" /></Icon>
);
export const InboxIcon = (p: IconProps) => (
  <Icon {...p}><path d="M3 13h5l1.5 3h5L16 13h5" /><path d="M5.5 5h13L21 13v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z" /></Icon>
);
export const ShieldIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6z" /><path d="m9 12 2 2 4-4" /></Icon>
);
export const SunIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Icon>
);
export const MoonIcon = (p: IconProps) => (
  <Icon {...p}><path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z" /></Icon>
);
export const MonitorIcon = (p: IconProps) => (
  <Icon {...p}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></Icon>
);
export const WarningIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></Icon>
);
export const CheckIcon = (p: IconProps) => (
  <Icon {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Icon>
);
export const CloseIcon = (p: IconProps) => (
  <Icon {...p}><path d="M6 6l12 12M18 6 6 18" /></Icon>
);
export const PlusIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>
);
export const ChevronDownIcon = (p: IconProps) => (
  <Icon {...p}><path d="m6 9 6 6 6-6" /></Icon>
);
export const MenuIcon = (p: IconProps) => (
  <Icon {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Icon>
);
export const ArrowUpIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 19V5M6 11l6-6 6 6" /></Icon>
);
export const ArrowDownIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 5v14M6 13l6 6 6-6" /></Icon>
);
export const ChartIcon = (p: IconProps) => (
  <Icon {...p}><rect x="3" y="3" width="18" height="18" rx="4" /><path d="m7 15 3-4 3 2.5 4-5.5" /></Icon>
);
export const ClockIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>
);
export const ChevronLeftIcon = (p: IconProps) => (
  <Icon {...p}><path d="m15 6-6 6 6 6" /></Icon>
);
export const ChevronRightIcon = (p: IconProps) => (
  <Icon {...p}><path d="m9 6 6 6-6 6" /></Icon>
);
export const CalendarIcon = (p: IconProps) => (
  <Icon {...p}><path d="M8 2v3M16 2v3M3.5 9.1h17" /><rect x="3" y="3.5" width="18" height="18" rx="3" /><path d="M15.7 13.7h.01M15.7 16.7h.01M11.995 13.7h.01M11.995 16.7h.01M8.294 13.7h.01M8.294 16.7h.01" strokeWidth={2} /></Icon>
);

// Category icons (lib/categories.ts) and the How-it-works / search / photo set.
export const BoltIcon = (p: IconProps) => (
  <Icon {...p}><path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z" /></Icon>
);
export const WrenchIcon = (p: IconProps) => (
  <Icon {...p}><path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3.6 17.2a1.9 1.9 0 0 0 2.7 2.7l5.7-5.7a4 4 0 0 0 5.2-5.4l-2.5 2.5-2.3-.4-.4-2.3 2.7-2.3Z" /></Icon>
);
export const SproutIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 21v-9M12 12c0-3.9-3.1-7-7-7 0 3.9 3.1 7 7 7ZM12 14c0-3.3 2.7-6 6-6 0 3.3-2.7 6-6 6Z" /></Icon>
);
export const PotIcon = (p: IconProps) => (
  <Icon {...p}><path d="M3 10h18M5 10v7a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-7M9 6V4M12 6V3M15 6V4M1.5 10H3M21 10h1.5" /></Icon>
);
export const TentIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 3 2 20h20L12 3ZM12 3v17M9 20l3-6 3 6" /></Icon>
);
export const SparkleIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 3c.5 4.5 2.5 6.5 7 7-4.5.5-6.5 2.5-7 7-.5-4.5-2.5-6.5-7-7 4.5-.5 6.5-2.5 7-7ZM19 15c.2 1.6.9 2.3 2.5 2.5-1.6.2-2.3.9-2.5 2.5-.2-1.6-.9-2.3-2.5-2.5 1.6-.2 2.3-.9 2.5-2.5Z" /></Icon>
);
export const BellIcon = (p: IconProps) => (
  <Icon {...p}><path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9ZM10 20a2 2 0 0 0 4 0" /></Icon>
);
export const SearchIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Icon>
);
export const ImageIcon = (p: IconProps) => (
  <Icon {...p}><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.8" /><path d="m4 18 5-5 3.5 3.5L16 13l4 4" /></Icon>
);
export const UploadIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></Icon>
);
export const UserIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.4-3.5 4.4-5 8-5s6.6 1.5 8 5" /></Icon>
);
// View switcher (board layouts).
export const CardsIcon = (p: IconProps) => (
  <Icon {...p}><rect x="3" y="3" width="8" height="10" rx="2" /><rect x="13" y="3" width="8" height="10" rx="2" /><path d="M3 17h8M13 17h8M3 21h5M13 21h5" /></Icon>
);
export const TilesIcon = (p: IconProps) => (
  <Icon {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Icon>
);
export const ListIcon = (p: IconProps) => (
  <Icon {...p}><rect x="3" y="4" width="5" height="5" rx="1" /><rect x="3" y="15" width="5" height="5" rx="1" /><path d="M11 6.5h10M11 17.5h10" /></Icon>
);

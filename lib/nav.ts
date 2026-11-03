export type NavIcon = "tools" | "listings" | "requests" | "incoming" | "admin";
export type NavLink = { href: string; label: string; icon: NavIcon };

const base: NavLink[] = [
  { href: "/tools", label: "All tools", icon: "tools" },
  { href: "/listings", label: "My listings", icon: "listings" },
  { href: "/requests", label: "My requests", icon: "requests" },
  { href: "/incoming", label: "Incoming", icon: "incoming" },
];

/** Signed-in navigation; Admin only appears for admins (the server enforces it too). */
export function appNav(role: "admin" | "user" | undefined): NavLink[] {
  return role === "admin" ? [...base, { href: "/admin", label: "Admin", icon: "admin" }] : base;
}

/** A link is active on its own page and on any nested page under it. */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

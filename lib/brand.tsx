// Shared artwork for generated icons and the social preview image.
export const brand = {
  violet: "#7364db",
  lilac: "#b2a7ff",
  paper: "#f5f5fa",
  ink: "#16161e",
  muted: "#636373",
};

/**
 * LendLoop mark: a combination wrench whose ring end is the "loop": a tool
 * that comes back. 64-unit grid, rotated 45°, legible down to 16px.
 */
export function Mark({ size, title }: { size: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <rect width="64" height="64" rx="16" fill={brand.violet} />
      <g transform="translate(32 32) rotate(45)">
        <path fill="#ffffff" d="M3.2 -25.4 A9.5 9.5 0 1 1 -3.2 -25.4 L-3.2 -19 L3.2 -19 Z" />
        <rect x="-3.5" y="-10" width="7" height="17" fill="#ffffff" />
        <circle cy="15.5" r="7.5" fill="none" stroke="#ffffff" strokeWidth="5.5" />
        <circle cy="15.5" r="2.5" fill={brand.lilac} />
      </g>
    </svg>
  );
}

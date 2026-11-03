// Shared artwork for generated icons and the social preview image.
export const brand = {
  violet: "#7364db",
  lilac: "#b2a7ff",
  paper: "#f5f5fa",
  ink: "#16161e",
  muted: "#636373",
};

export function Mark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <rect width="64" height="64" rx="14" fill={brand.violet} />
      <path d="M20 16v26h12" fill="none" stroke={brand.paper} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="42" cy="38" r="8" fill="none" stroke={brand.lilac} strokeWidth="5" />
    </svg>
  );
}

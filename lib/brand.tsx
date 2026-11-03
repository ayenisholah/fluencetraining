// Shared artwork for generated icons and the social preview image.
export const brand = {
  green: "#2f6b4f",
  mint: "#7cc39c",
  paper: "#f7f5f0",
  ink: "#1f2421",
};

export function Mark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <rect width="64" height="64" rx="14" fill={brand.green} />
      <path d="M20 16v26h12" fill="none" stroke={brand.paper} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="42" cy="38" r="8" fill="none" stroke={brand.mint} strokeWidth="5" />
    </svg>
  );
}

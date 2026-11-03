import { ImageResponse } from "next/og";
import { brand, Mark } from "@/lib/brand";

export const alt = "LendLoop: Borrow what you need. Lend what you don't.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: brand.paper,
          color: brand.ink,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Mark size={88} />
          <div style={{ display: "flex", fontSize: 56, fontWeight: 700 }}>
            Lend<span style={{ color: brand.violet }}>Loop</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, maxWidth: 980 }}>
            Borrow what you need. Lend what you don&apos;t.
          </div>
          <div style={{ fontSize: 32, color: brand.muted }}>
            A neighbourhood board for the tools that spend most of the year in a cupboard.
          </div>
        </div>
      </div>
    ),
    size,
  );
}

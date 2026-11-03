import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Poppins } from "next/font/google";
import { Analytics } from "@/components/Analytics";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { CookieConsent } from "@/components/CookieConsent";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

// Frox type: Poppins. Only the weights the type scale uses are loaded.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "LendLoop", template: "%s · LendLoop" },
  description: "Borrow what you need. Lend what you don't. A neighbourhood board for lending tools.",
  applicationName: "LendLoop",
  openGraph: {
    type: "website",
    siteName: "LendLoop",
    title: "LendLoop",
    description: "Borrow what you need. Lend what you don't.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "LendLoop",
    description: "Borrow what you need. Lend what you don't.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5fa" },
    { media: "(prefers-color-scheme: dark)", color: "#1f2128" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Per-request CSP nonce set by Clerk in proxy.ts. Next nonces its own
  // scripts; this inline one (theme before paint) needs it explicitly.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    // data-theme is set before paint by the inline script, so React's
    // first render may differ from the server HTML on this attribute.
    <html lang="en" className={`${poppins.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col font-sans text-body">
        {/* dynamic: Clerk reads the nonce for its own script tags. */}
        <ClerkProvider dynamic>
          <ConvexClientProvider>
            {children}
            <CookieConsent />
            <Analytics />
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}

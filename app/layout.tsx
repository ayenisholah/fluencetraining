import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Analytics } from "@/components/Analytics";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { CookieConsent, CookieSettingsButton } from "@/components/CookieConsent";
import { Nav } from "@/components/Nav";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

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
    { media: "(prefers-color-scheme: light)", color: "#f7f5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#141714" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <ClerkProvider>
          <ConvexClientProvider>
            <Nav />
            <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
            <footer className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-6 text-xs text-muted">
              <span>LendLoop is a fictional neighbourhood lending board.</span>
              <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-2 sm:ml-auto">
                <Link href="/privacy" className="underline-offset-2 hover:underline">Privacy</Link>
                <Link href="/terms" className="underline-offset-2 hover:underline">Terms</Link>
                <CookieSettingsButton />
              </nav>
            </footer>
            <CookieConsent />
            <Analytics />
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}

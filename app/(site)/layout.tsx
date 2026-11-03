import { Footer } from "@/components/shell/Footer";
import { SiteHeader } from "@/components/shell/SiteHeader";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">{children}</main>
      <Footer className="mx-auto w-full max-w-6xl px-4" />
    </>
  );
}

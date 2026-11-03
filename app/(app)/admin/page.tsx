import type { Metadata } from "next";
import { AdminScreen } from "@/components/screens/Admin";

export const metadata: Metadata = {
  title: "Admin",
  description: "Moderation and automation health.",
  // Signed-in area: keep it out of search results.
  robots: { index: false, follow: false },
};

export default function Page() {
  return <AdminScreen />;
}

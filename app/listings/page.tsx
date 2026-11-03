import type { Metadata } from "next";
import { ListingsScreen } from "@/components/screens/Listings";

export const metadata: Metadata = {
  title: "My listings",
  description: "Manage the tools you lend.",
  // Signed-in area: keep it out of search results.
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ListingsScreen />;
}

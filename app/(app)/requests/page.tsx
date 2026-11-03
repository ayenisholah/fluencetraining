import type { Metadata } from "next";
import { RequestsScreen } from "@/components/screens/Requests";

export const metadata: Metadata = {
  title: "My requests",
  description: "Track the tools you've asked to borrow.",
  // Signed-in area: keep it out of search results.
  robots: { index: false, follow: false },
};

export default function Page() {
  return <RequestsScreen />;
}

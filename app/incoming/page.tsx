import type { Metadata } from "next";
import { IncomingScreen } from "@/components/screens/Incoming";

export const metadata: Metadata = {
  title: "Incoming requests",
  description: "Approve or decline requests for your tools.",
  // Signed-in area: keep it out of search results.
  robots: { index: false, follow: false },
};

export default function Page() {
  return <IncomingScreen />;
}

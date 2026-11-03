import type { Metadata } from "next";
import { ToolsScreen } from "@/components/screens/Tools";

export const metadata: Metadata = {
  title: "All tools",
  description: "Browse tools your neighbours are lending.",
  // Signed-in area: keep it out of search results.
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ToolsScreen />;
}

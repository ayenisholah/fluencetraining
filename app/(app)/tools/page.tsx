import type { Metadata } from "next";
import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import { ToolsScreen } from "@/components/screens/Tools";

export const metadata: Metadata = {
  title: "All tools",
  description: "Browse tools your neighbours are lending.",
  // Signed-in area: keep it out of search results.
  robots: { index: false, follow: false },
};

export default function Page() {
  // The screen keeps its search and filters in the URL (useSearchParams).
  return (
    <Suspense fallback={<Spinner />}>
      <ToolsScreen />
    </Suspense>
  );
}

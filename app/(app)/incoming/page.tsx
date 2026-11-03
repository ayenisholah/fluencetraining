import type { Metadata } from "next";
import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import { IncomingScreen } from "@/components/screens/Incoming";

export const metadata: Metadata = {
  title: "Incoming requests",
  description: "Approve or decline requests for your tools.",
  // Signed-in area: keep it out of search results.
  robots: { index: false, follow: false },
};

export default function Page() {
  // The screen keeps its search and filters in the URL (useSearchParams).
  return (
    <Suspense fallback={<Spinner />}>
      <IncomingScreen />
    </Suspense>
  );
}

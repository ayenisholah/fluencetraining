import type { Metadata } from "next";
import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import { RequestsScreen } from "@/components/screens/Requests";

export const metadata: Metadata = {
  title: "My requests",
  description: "Track the tools you've asked to borrow.",
  // Signed-in area: keep it out of search results.
  robots: { index: false, follow: false },
};

export default function Page() {
  // The screen keeps its search and filters in the URL (useSearchParams).
  return (
    <Suspense fallback={<Spinner />}>
      <RequestsScreen />
    </Suspense>
  );
}

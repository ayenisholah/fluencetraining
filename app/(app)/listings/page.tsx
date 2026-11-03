import type { Metadata } from "next";
import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import { ListingsScreen } from "@/components/screens/Listings";

export const metadata: Metadata = {
  title: "My listings",
  description: "Manage the tools you lend.",
  // Signed-in area: keep it out of search results.
  robots: { index: false, follow: false },
};

export default function Page() {
  // The screen keeps its search and filters in the URL (useSearchParams).
  return (
    <Suspense fallback={<Spinner />}>
      <ListingsScreen />
    </Suspense>
  );
}

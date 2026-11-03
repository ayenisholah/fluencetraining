import type { Metadata } from "next";
import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import { AdminScreen } from "@/components/screens/Admin";

export const metadata: Metadata = {
  title: "Admin",
  description: "Moderation and automation health.",
  // Signed-in area: keep it out of search results.
  robots: { index: false, follow: false },
};

export default function Page() {
  // The screen keeps its search and filters in the URL (useSearchParams).
  return (
    <Suspense fallback={<Spinner />}>
      <AdminScreen />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import { HomeScreen } from "@/components/screens/Home";

export const metadata: Metadata = {
  title: { absolute: "LendLoop · Borrow what you need. Lend what you don't." },
  description: "Borrow what you need. Lend what you don't. A neighbourhood board for lending tools.",
  alternates: { canonical: "/" },
};

export default function Page() {
  // The screen keeps its search and filters in the URL (useSearchParams).
  return (
    <Suspense fallback={<Spinner />}>
      <HomeScreen />
    </Suspense>
  );
}

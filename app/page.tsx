import type { Metadata } from "next";
import { HomeScreen } from "@/components/screens/Home";

export const metadata: Metadata = {
  title: { absolute: "LendLoop · Borrow what you need. Lend what you don't." },
  description: "Borrow what you need. Lend what you don't. A neighbourhood board for lending tools.",
  alternates: { canonical: "/" },
};

export default function Page() {
  return <HomeScreen />;
}

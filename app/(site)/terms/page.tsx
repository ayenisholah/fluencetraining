import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms and conditions",
  description: "The rules for lending and borrowing on LendLoop.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms and conditions" updated="3 November 2026">
      <section>
        <h2>The service</h2>
        <p>
          LendLoop is a noticeboard that helps neighbours lend and borrow tools. We don&apos;t own, inspect, insure or
          deliver any tool, and we aren&apos;t a party to any loan.
        </p>
      </section>

      <section>
        <h2>Your account</h2>
        <ul>
          <li>Use your real name so neighbours know who they&apos;re dealing with.</li>
          <li>Keep your sign-in secure. You&apos;re responsible for activity on your account.</li>
          <li>One person, one account.</li>
        </ul>
      </section>

      <section>
        <h2>Lending</h2>
        <ul>
          <li>Only list tools you own and are happy to lend.</li>
          <li>Describe their condition honestly, including anything a borrower should know to use them safely.</li>
          <li>Approve or decline requests promptly, and mark loans returned when you get the tool back.</li>
        </ul>
      </section>

      <section>
        <h2>Borrowing</h2>
        <ul>
          <li>Use tools for their intended purpose and follow any safety instructions.</li>
          <li>Return them on time, clean and in the same condition.</li>
          <li>If something breaks, tell the lender straight away and agree a fair fix.</li>
        </ul>
      </section>

      <section>
        <h2>Not allowed</h2>
        <ul>
          <li>Listings for illegal, dangerous or recalled items, or anything that isn&apos;t a tool.</li>
          <li>Spam, advertising, or repeated requests you don&apos;t intend to collect.</li>
          <li>Harassing other members, or using their details for anything except arranging a loan.</li>
        </ul>
        <p>Administrators can remove listings and close accounts that break these rules.</p>
      </section>

      <section>
        <h2>No warranty</h2>
        <p>
          The service is provided as is. Lenders and borrowers are responsible for the tools and for how they&apos;re
          used. To the extent the law allows, LendLoop isn&apos;t liable for loss, damage or injury arising from a loan.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          We&apos;ll post updates to these terms on this page and tell active members by email before significant
          changes take effect.
        </p>
      </section>
    </LegalPage>
  );
}

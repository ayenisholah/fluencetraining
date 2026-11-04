import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What LendLoop collects, why, who processes it and how long it is kept.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="3 November 2026">
      <section>
        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Account details:</strong> your name and email address, handled by our sign-in provider, Clerk, when
            you create an account.
          </li>
          <li>
            <strong>What you post:</strong> tool listings (name, category, condition, description) and borrow requests
            (tool, dates, status).
          </li>
          <li>
            <strong>Notification history:</strong> whether we sent you an email about a request or an overdue loan, and
            when.
          </li>
        </ul>
        <p>We don&apos;t collect payment details, location, or contacts.</p>
      </section>

      <section>
        <h2>Why we use it</h2>
        <ul>
          <li>To run the service: showing listings, routing requests to lenders, and tracking loans.</li>
          <li>To send the emails the service depends on: new requests, decisions, returns and overdue reminders.</li>
          <li>To keep it safe: rate limits, abuse checks, and admin moderation.</li>
        </ul>
      </section>

      <section>
        <h2>Who sees what</h2>
        <ul>
          <li>Visitors who aren&apos;t signed in see tool names and categories only.</li>
          <li>Signed-in neighbours see a lender&apos;s first name, never their email.</li>
          <li>The lender and borrower on a request see each other&apos;s first names.</li>
          <li>Administrators can see account names and emails to moderate the board.</li>
        </ul>
        <p>
          Notification emails contain only what that email needs: your address and first name, the other person&apos;s
          first name, the tool name, and the dates.
        </p>
      </section>

      <section>
        <h2>Service providers</h2>
        <p>
          Clerk (sign-in), Convex (database and backend), our workflow automation service (n8n), and our email provider
          process data on our behalf, under their own security commitments. We don&apos;t sell personal data or use it
          for advertising.
        </p>
      </section>

      <section id="cookies">
        <h2>Cookies and analytics</h2>
        <p>
          <strong>Essential:</strong> Clerk sets cookies that keep you signed in. The service can&apos;t work without
          them, so they don&apos;t need your consent.
        </p>
        <p>
          <strong>Optional:</strong> if you allow it in the cookie banner, we count page views with a privacy-friendly
          analytics script that sets no cookies and doesn&apos;t track you across sites. You can change your choice any
          time with &ldquo;Cookie settings&rdquo; in the footer.
        </p>
      </section>

      <section>
        <h2>How long we keep it</h2>
        <ul>
          <li>Account and listing data: until you delete your account.</li>
          <li>Loan history: kept while your account exists, then anonymised.</li>
          <li>Notification and error logs: up to 90 days.</li>
        </ul>
      </section>

      <section>
        <h2>Your choices</h2>
        <p>
          You can edit or delete your listings at any time, and delete your account from your profile menu. To ask for a
          copy of your data or its deletion, contact privacy@lendloop.example.
        </p>
      </section>
    </LegalPage>
  );
}

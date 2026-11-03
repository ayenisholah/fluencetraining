import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { escapeHtml } from "./layout";
import { calendarLink, dateRange, loanEventEmail, type LoanEmailInput, type LoanEventName } from "./loanEmails";
import { overdueReminderEmail } from "./reminderEmail";

const base: Omit<LoanEmailInput, "event"> = {
  recipientFirstName: "Olu",
  otherFirstName: "Remi",
  toolName: "Ladder",
  toolCategory: "hand_tools",
  startDate: "2026-11-04",
  endDate: "2026-11-06",
};

beforeEach(() => {
  process.env.LENDLOOP_APP_URL = "https://lendloop.example/";
});
afterEach(() => {
  delete process.env.LENDLOOP_APP_URL;
});

const EXPECT: Record<LoanEventName, { subject: string; banner: string; cta: string; path: string }> = {
  "loan.requested": { subject: "Remi wants to borrow your Ladder", banner: "New borrow request", cta: "Review request", path: "/incoming?phase=open" },
  "loan.approved": { subject: "Remi said yes: Ladder", banner: "Request approved", cta: "View my requests", path: "/requests" },
  "loan.declined": { subject: "Your request for Ladder was declined", banner: "Request declined", cta: "Browse other tools", path: "/tools" },
  "loan.cancelled": { subject: "Remi cancelled their request for your Ladder", banner: "Request cancelled", cta: "View incoming requests", path: "/incoming" },
  "loan.returned": { subject: "Thanks for returning Ladder", banner: "Loan returned", cta: "Browse tools", path: "/tools" },
};

describe("loan event emails", () => {
  test.each(Object.entries(EXPECT))("%s: subject, banner, greeting, card and CTA", (event, want) => {
    const { subject, html, text } = loanEventEmail({ ...base, event: event as LoanEventName });
    expect(subject).toBe(want.subject);
    expect(html).toContain(want.banner);
    expect(html).toContain("Hi Olu,");
    expect(html).toContain("Lend<span");
    expect(html).toMatch(/Hand tools<\/span>/); // category chip in its preset colour
    expect(html).toContain("#e7efff"); // blue preset soft fill
    expect(html).toContain("4 Nov 2026 – 6 Nov 2026");
    expect(html).toContain(`href="https://lendloop.example${want.path}"`);
    expect(html).toContain(want.cta);
    // Plain-text alternative carries the same content and link.
    expect(text).toContain("Hi Olu,");
    expect(text).toContain(`${want.cta}: https://lendloop.example${want.path}`);
    expect(text).toContain("Ladder (Hand tools)");
    expect(text).not.toMatch(/<[a-z]/i);
  });

  test("user text is escaped everywhere it appears", () => {
    const { html, subject } = loanEventEmail({
      ...base,
      event: "loan.requested",
      toolName: `<img src=x onerror="alert(1)">`,
      otherFirstName: `Eve"><script>`,
    });
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain("Eve&quot;&gt;&lt;script&gt;");
    // Subjects are plain text headers, not HTML.
    expect(subject).toBe(`Eve"><script> wants to borrow your <img src=x onerror="alert(1)">`);
    expect(escapeHtml(`'&`)).toBe("&#39;&amp;");
  });

  test("only first names appear; no email addresses in the message", () => {
    for (const event of Object.keys(EXPECT) as LoanEventName[]) {
      const { html, text } = loanEventEmail({ ...base, event });
      expect(html).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
      expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    }
  });

  test("the approval email links to Google Calendar for the loan days", () => {
    const { html } = loanEventEmail({ ...base, event: "loan.approved" });
    expect(html).toContain("Add to Google Calendar");
    const url = new URL(calendarLink("Ladder", "Remi", "2026-11-04", "2026-11-06"));
    expect(url.hostname).toBe("calendar.google.com");
    expect(url.searchParams.get("dates")).toBe("20261104/20261107"); // all-day, end exclusive
    expect(url.searchParams.get("text")).toBe("Borrowing Ladder from Remi");
    expect(loanEventEmail({ ...base, event: "loan.requested" }).html).not.toContain("Google Calendar");
  });

  test("single-day loans show one date; unknown categories fall back to Other", () => {
    expect(dateRange("2026-11-04", "2026-11-04")).toBe("4 Nov 2026");
    const { html } = loanEventEmail({ ...base, event: "loan.requested", toolCategory: undefined });
    expect(html).toMatch(/Other<\/span>/);
  });

  test("email-safe structure: presentation tables, a preheader, image alt, under Gmail's clip size", () => {
    const { html } = loanEventEmail({ ...base, event: "loan.approved" });
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html.match(/<table /g)?.length).toBe(html.match(/<table role="presentation"/g)?.length);
    expect(html).toContain('<img src="https://lendloop.example/apple-icon" alt=""');
    expect(html).toContain("display:none;max-height:0"); // preheader
    expect(html).not.toMatch(/<script|<style|class=/);
    expect(new TextEncoder().encode(html).byteLength).toBeLessThan(100 * 1024);
  });
});

describe("overdue reminder email", () => {
  const reminder = { borrowerFirstName: "Remi", lenderFirstName: "Olu", toolName: "Ladder", toolCategory: "hand_tools", endDate: "2026-11-01", daysOverdue: 2 };

  test("warning banner, due date, days overdue, lender and CTA", () => {
    const { subject, html, text } = overdueReminderEmail(reminder);
    expect(subject).toBe("Reminder: please return Ladder");
    expect(html).toContain("Overdue: please return");
    expect(html).toContain("Hi Remi,");
    expect(html).toContain("1 Nov 2026");
    expect(html).toContain("2 days");
    expect(html).toContain('href="https://lendloop.example/requests"');
    expect(text).toContain("was due back to Olu on 1 Nov 2026, 2 days ago");
    expect(text).toContain("View my requests: https://lendloop.example/requests");
  });

  test("singular day, and escaping", () => {
    const { html, text } = overdueReminderEmail({ ...reminder, daysOverdue: 1, toolName: "<b>Saw</b>" });
    expect(text).toContain("1 day ago");
    expect(html).toContain("&lt;b&gt;Saw&lt;/b&gt;");
    expect(html).not.toContain("<b>Saw</b>");
  });
});

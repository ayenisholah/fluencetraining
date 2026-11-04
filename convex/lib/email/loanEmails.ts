// Loan-event notifications (rendered in Convex, sent by n8n workflow 01).
// Inputs are the minimal webhook fields: first names, tool, dates.
import { EMAIL_CATEGORIES, emailAppUrl } from "./branding";
import {
  banner,
  buttons,
  card,
  categoryChip,
  escapeHtml,
  intro,
  note,
  wrapper,
  type RenderedEmail,
  type Tone,
} from "./layout";

export type LoanEventName = "loan.requested" | "loan.approved" | "loan.declined" | "loan.cancelled" | "loan.returned";

export type LoanEmailInput = {
  event: LoanEventName;
  recipientFirstName: string;
  otherFirstName: string;
  toolName: string;
  toolCategory?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
};

/** "4 Nov 2026", in UTC like the rest of LendLoop's calendar dates. */
export function emailDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function dateRange(start: string, end: string): string {
  return start === end ? emailDate(start) : `${emailDate(start)} – ${emailDate(end)}`;
}

/** Google Calendar "add event" link for an all-day loan (the end date is exclusive). */
export function calendarLink(toolName: string, lenderFirstName: string, start: string, end: string): string {
  const compact = (iso: string) => iso.replace(/-/g, "");
  const after = new Date(`${end}T00:00:00Z`);
  after.setUTCDate(after.getUTCDate() + 1);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Borrowing ${toolName} from ${lenderFirstName}`,
    dates: `${compact(start)}/${compact(after.toISOString().slice(0, 10))}`,
    details: `LendLoop loan. Return it by ${emailDate(end)}. ${emailAppUrl()}/requests`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

type Copy = {
  subject: string;
  banner: string;
  tone: Tone;
  intro: string; // plain text; escaped when rendered
  otherLabel: string;
  status: string;
  actions: { label: string; path: string }[];
  closing?: string;
};

function copyFor(i: LoanEmailInput): Copy {
  const who = i.otherFirstName;
  const tool = i.toolName;
  const dates = dateRange(i.startDate, i.endDate);
  switch (i.event) {
    case "loan.requested":
      return {
        subject: `${who} wants to borrow your ${tool}`,
        banner: "New borrow request",
        tone: "brand",
        intro: `${who} has asked to borrow your ${tool} for ${dates}. Approve or decline it when you're ready.`,
        otherLabel: "Requested by",
        status: "Waiting for you",
        actions: [{ label: "Review request", path: "/incoming?phase=open" }],
        closing: "Requests whose dates pass without an answer can't be approved later.",
      };
    case "loan.approved":
      return {
        subject: `${who} said yes: ${tool}`,
        banner: "Request approved",
        tone: "success",
        intro: `Good news: ${who} approved your request to borrow their ${tool} for ${dates}. Arrange the hand-over with them directly.`,
        otherLabel: "Lent by",
        status: "On loan",
        actions: [{ label: "View my requests", path: "/requests" }],
        closing: "We'll remind you if it isn't returned by the end date.",
      };
    case "loan.declined":
      return {
        subject: `Your request for ${tool} was declined`,
        banner: "Request declined",
        tone: "neutral",
        intro: `${who} can't lend the ${tool} for ${dates} this time. There may be another one on the board.`,
        otherLabel: "Lender",
        status: "Declined",
        actions: [{ label: "Browse other tools", path: "/tools" }],
      };
    case "loan.cancelled":
      return {
        subject: `${who} cancelled their request for your ${tool}`,
        banner: "Request cancelled",
        tone: "neutral",
        intro: `${who} no longer needs your ${tool} for ${dates}. There's nothing else to do.`,
        otherLabel: "Requested by",
        status: "Cancelled",
        actions: [{ label: "View incoming requests", path: "/incoming" }],
      };
    case "loan.returned":
      return {
        subject: `Thanks for returning ${tool}`,
        banner: "Loan returned",
        tone: "success",
        intro: `${who} marked their ${tool} as returned. Thanks for looking after it.`,
        otherLabel: "Lent by",
        status: "Returned",
        actions: [{ label: "Browse tools", path: "/tools" }],
      };
  }
}

export function loanEventEmail(i: LoanEmailInput): RenderedEmail {
  const c = copyFor(i);
  const app = emailAppUrl();
  const greeting = `Hi ${i.recipientFirstName},`;
  const dates = dateRange(i.startDate, i.endDate);
  const actions = c.actions.map((a, index) => ({
    label: a.label,
    href: `${app}${a.path}`,
    variant: index === 0 ? ("solid" as const) : ("ghost" as const),
  }));
  if (i.event === "loan.approved") {
    actions.push({
      label: "Add to Google Calendar",
      href: calendarLink(i.toolName, i.otherFirstName, i.startDate, i.endDate),
      variant: "ghost",
    });
  }
  const html = wrapper(
    [
      banner(c.banner, c.tone),
      intro(greeting, escapeHtml(c.intro)),
      card("Loan details", [
        ["Tool", `<strong>${escapeHtml(i.toolName)}</strong>&nbsp; ${categoryChip(i.toolCategory)}`],
        ["Dates", escapeHtml(dates)],
        [c.otherLabel, escapeHtml(i.otherFirstName)],
        ["Status", escapeHtml(c.status)],
      ]),
      buttons(actions),
      c.closing ? note(c.closing) : "",
    ].join(""),
    { preheader: c.intro, title: c.subject },
  );
  const category = EMAIL_CATEGORIES[i.toolCategory ?? ""]?.label;
  const text = [
    greeting,
    "",
    c.intro,
    "",
    `Tool: ${i.toolName}${category ? ` (${category})` : ""}`,
    `Dates: ${dates}`,
    `${c.otherLabel}: ${i.otherFirstName}`,
    `Status: ${c.status}`,
    "",
    ...actions.map((a) => `${a.label}: ${a.href}`),
    ...(c.closing ? ["", c.closing] : []),
    "",
    "LendLoop",
  ].join("\n");
  return { subject: c.subject, html, text };
}

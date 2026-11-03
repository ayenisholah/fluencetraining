// Daily overdue reminder (rendered in Convex, sent by n8n workflow 02).
import { EMAIL_CATEGORIES, emailAppUrl } from "./branding";
import { banner, buttons, card, categoryChip, escapeHtml, intro, note, wrapper, type RenderedEmail } from "./layout";
import { emailDate } from "./loanEmails";

export type ReminderInput = {
  borrowerFirstName: string;
  lenderFirstName: string;
  toolName: string;
  toolCategory?: string;
  endDate: string;
  daysOverdue: number;
};

export function overdueReminderEmail(i: ReminderInput): RenderedEmail {
  const app = emailAppUrl();
  const days = `${i.daysOverdue} day${i.daysOverdue === 1 ? "" : "s"}`;
  const subject = `Reminder: please return ${i.toolName}`;
  const introText = `${i.toolName} was due back to ${i.lenderFirstName} on ${emailDate(i.endDate)}, ${days} ago. Please arrange to return it.`;
  const greeting = `Hi ${i.borrowerFirstName},`;
  const closing = "Already returned it? Ask the lender to mark it returned in LendLoop and the reminders stop.";
  const html = wrapper(
    [
      banner("Overdue: please return", "warning"),
      intro(greeting, escapeHtml(introText)),
      card("Loan details", [
        ["Tool", `<strong>${escapeHtml(i.toolName)}</strong>&nbsp; ${categoryChip(i.toolCategory)}`],
        ["Due back", escapeHtml(emailDate(i.endDate))],
        ["Overdue by", `<strong style="color:#9c4a14;">${escapeHtml(days)}</strong>`],
        ["Lent by", escapeHtml(i.lenderFirstName)],
      ]),
      buttons([{ label: "View my requests", href: `${app}/requests` }]),
      note(closing),
    ].join(""),
    { preheader: introText, title: subject },
  );
  const category = EMAIL_CATEGORIES[i.toolCategory ?? ""]?.label;
  const text = [
    greeting,
    "",
    introText,
    "",
    `Tool: ${i.toolName}${category ? ` (${category})` : ""}`,
    `Due back: ${emailDate(i.endDate)}`,
    `Overdue by: ${days}`,
    `Lent by: ${i.lenderFirstName}`,
    "",
    `View my requests: ${app}/requests`,
    "",
    closing,
    "",
    "LendLoop",
  ].join("\n");
  return { subject, html, text };
}

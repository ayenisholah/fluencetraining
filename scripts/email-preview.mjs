// Renders every notification email with sample data to email-previews/*.html
// (git-ignored) so they can be opened in a browser: `npm run email:preview`.
// Bundles the TypeScript templates in memory with esbuild (a Convex dependency).
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const out = `${root}email-previews`;

const { outputFiles } = await build({
  stdin: {
    contents: `
      export { loanEventEmail } from "./convex/lib/email/loanEmails";
      export { overdueReminderEmail } from "./convex/lib/email/reminderEmail";
    `,
    resolveDir: root,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const mod = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);

process.env.LENDLOOP_APP_URL ??= "http://localhost:3000";
const loan = { recipientFirstName: "Olu", otherFirstName: "Remi", toolName: "Extension ladder, 3.8 m", toolCategory: "hand_tools", startDate: "2026-11-04", endDate: "2026-11-06" };
const emails = {
  "loan-requested": mod.loanEventEmail({ ...loan, event: "loan.requested" }),
  "loan-approved": mod.loanEventEmail({ ...loan, event: "loan.approved", recipientFirstName: "Remi", otherFirstName: "Olu" }),
  "loan-declined": mod.loanEventEmail({ ...loan, event: "loan.declined", recipientFirstName: "Remi", otherFirstName: "Olu" }),
  "loan-cancelled": mod.loanEventEmail({ ...loan, event: "loan.cancelled" }),
  "loan-returned": mod.loanEventEmail({ ...loan, event: "loan.returned", recipientFirstName: "Remi", otherFirstName: "Olu", toolCategory: "garden", toolName: "Petrol lawnmower" }),
  "overdue-reminder": mod.overdueReminderEmail({ borrowerFirstName: "Remi", lenderFirstName: "Olu", toolName: "4-person tent", toolCategory: "camping", endDate: "2026-11-01", daysOverdue: 2 }),
};

mkdirSync(out, { recursive: true });
const index = [];
for (const [name, email] of Object.entries(emails)) {
  writeFileSync(`${out}/${name}.html`, email.html);
  writeFileSync(`${out}/${name}.txt`, `Subject: ${email.subject}\n\n${email.text}`);
  index.push(`<li><a href="${name}.html">${name}</a>: ${email.subject.replace(/</g, "&lt;")} (<a href="${name}.txt">text</a>)</li>`);
}
writeFileSync(`${out}/index.html`, `<!doctype html><meta charset="utf-8"><title>LendLoop emails</title><h1>LendLoop emails</h1><ul>${index.join("")}</ul>`);
console.log(`Wrote ${Object.keys(emails).length} emails to email-previews/ (open email-previews/index.html)`);

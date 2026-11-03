// Table-based, inline-styled building blocks for HTML email: the only layout
// every client (Gmail, Outlook, Apple Mail) renders reliably. All user text
// must pass through escapeHtml().
import { EMAIL_CATEGORIES, EMAIL_COLORS as C, EMAIL_PRESETS, emailAppUrl, emailLogoUrl } from "./branding";

export type RenderedEmail = { subject: string; html: string; text: string };
export type Tone = "brand" | "success" | "warning" | "neutral";

const FONT = "'Poppins',Arial,Helvetica,sans-serif";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const TONES: Record<Tone, { bg: string; fg: string }> = {
  brand: { bg: C.brand, fg: "#ffffff" },
  success: { bg: C.success, fg: "#ffffff" },
  warning: { bg: C.warning, fg: "#ffffff" },
  neutral: { bg: C.neutral, fg: "#ffffff" },
};

/** The page: hidden preheader, header with the mark and wordmark, body rows, footer. */
export function wrapper(body: string, { preheader, title }: { preheader: string; title: string }): string {
  const app = emailAppUrl();
  const year = new Date().getUTCFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>${escapeHtml(title)}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${C.paper};font-family:${FONT};-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.paper};">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.paper};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
             style="max-width:600px;width:100%;background-color:${C.surface};border:1px solid ${C.border};border-radius:16px;overflow:hidden;">
        <tr>
          <td style="padding:24px 40px;border-bottom:1px solid ${C.border};">
            <a href="${app}" style="text-decoration:none;display:inline-block;">
              <img src="${emailLogoUrl()}" alt="" width="32" height="32" style="display:inline-block;vertical-align:middle;border:0;border-radius:8px;" />
              <span style="display:inline-block;vertical-align:middle;margin-left:10px;font-size:20px;font-weight:700;color:${C.ink};">Lend<span style="color:${C.brand};">Loop</span></span>
            </a>
          </td>
        </tr>
        ${body}
        <tr>
          <td style="padding:24px 40px;background-color:${C.sunken};border-top:1px solid ${C.border};">
            <p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:${C.muted};">
              LendLoop · a neighbourhood tool library ·
              <a href="${app}" style="color:${C.brandText};text-decoration:none;">${escapeHtml(app.replace(/^https?:\/\//, ""))}</a> ·
              <a href="${app}/privacy" style="color:${C.brandText};text-decoration:none;">Privacy</a>
            </p>
            <p style="margin:0;font-size:11px;line-height:1.6;color:${C.muted};">
              You're receiving this because you lend or borrow on LendLoop. &copy; ${year} LendLoop.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** A thin coloured strip under the header naming what happened. */
export function banner(text: string, tone: Tone): string {
  const t = TONES[tone];
  return `<tr><td style="background-color:${t.bg};padding:8px 40px;">
    <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${t.fg};">${escapeHtml(text)}</p>
  </td></tr>`;
}

/** Greeting and one intro paragraph. `intro` may contain markup built from escaped parts. */
export function intro(greeting: string, introHtml: string): string {
  return `<tr><td style="padding:32px 40px 24px;">
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;font-weight:700;color:${C.ink};">${escapeHtml(greeting)}</h1>
    <p style="margin:0;font-size:15px;line-height:1.6;color:${C.muted};">${introHtml}</p>
  </td></tr>`;
}

/** A bordered summary card of label/value rows. Values are HTML built from escaped parts. */
export function card(heading: string, rows: [label: string, valueHtml: string][]): string {
  return `<tr><td style="padding:0 40px 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.border};border-radius:12px;overflow:hidden;">
      <tr><td colspan="2" style="padding:12px 16px 8px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${C.brandText};background-color:${C.sunken};border-bottom:1px solid ${C.border};">${escapeHtml(heading)}</td></tr>
      ${rows.map(([label, value]) => detailRow(label, value)).join("")}
    </table>
  </td></tr>`;
}

export function detailRow(label: string, valueHtml: string): string {
  return `<tr>
    <td width="38%" style="padding:11px 16px;font-size:13px;font-weight:600;color:${C.muted};border-bottom:1px solid ${C.border};vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:11px 16px;font-size:14px;color:${C.ink};border-bottom:1px solid ${C.border};">${valueHtml}</td>
  </tr>`;
}

/** The category as a coloured pill, in its preset colour. */
export function categoryChip(category: string | undefined): string {
  const c = EMAIL_CATEGORIES[category ?? ""] ?? EMAIL_CATEGORIES.other;
  const p = EMAIL_PRESETS[c.color];
  return `<span style="display:inline-block;padding:3px 10px;border-radius:999px;background-color:${p.soft};color:${p.text};font-size:12px;font-weight:600;">${escapeHtml(c.label)}</span>`;
}

/**
 * Call-to-action links as padded, inline-block buttons in one cell: side by
 * side when there's room, wrapping onto their own lines on a phone.
 */
export function buttons(list: { label: string; href: string; variant?: "solid" | "ghost" }[]): string {
  const links = list
    .map(({ label, href, variant = "solid" }) => {
      const colours =
        variant === "solid"
          ? `background-color:${C.brand};color:#ffffff;border:1px solid ${C.brand};`
          : `background-color:#ffffff;color:${C.ink};border:1px solid ${C.border};`;
      return `<a href="${escapeHtml(href)}" style="display:inline-block;margin:0 8px 10px 0;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:700;line-height:1.2;white-space:nowrap;text-decoration:none;${colours}">${escapeHtml(label)}</a>`;
    })
    .join("");
  return `<tr><td style="padding:0 40px 22px;">${links}</td></tr>`;
}

/** A short closing note. */
export function note(text: string): string {
  return `<tr><td style="padding:0 40px 32px;"><p style="margin:0;font-size:13px;line-height:1.6;color:${C.muted};">${escapeHtml(text)}</p></td></tr>`;
}

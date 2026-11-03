"use client";

import { useMutation, useQuery } from "convex/react";
import { Activity } from "@/components/LoanList";
import { Badge, Empty, Loading, LoanStatus, PageHeader } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { categoryLabel, formatDate, timeAgo } from "@/lib/format";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  );
}

export function AdminScreen() {
  const me = useQuery(api.users.me);
  if (me === undefined) return <Loading />;
  if (me?.role !== "admin") return <Empty>Admins only.</Empty>;
  return <AdminDashboard />;
}

function AdminDashboard() {
  const health = useQuery(api.admin.automationHealth);
  const loans = useQuery(api.admin.allLoans);
  const listings = useQuery(api.admin.listings);
  const users = useQuery(api.admin.users);
  const retry = useMutation(api.admin.retryDelivery);
  const removeListing = useMutation(api.admin.removeListing);
  const setTrusted = useMutation(api.admin.setTrustedLender);

  return (
    <>
      <PageHeader title="Admin" />
      <div className="space-y-10">
        <Section title="Automation health">
          {health === undefined ? <Loading /> : (
            <>
              {health.deliveries.length === 0 && health.workflowErrors.length === 0 && (
                <Empty>All webhooks delivered. No workflow errors.</Empty>
              )}
              {health.deliveries.map((d) => (
                <div key={d._id} className="card flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm">
                    <span className="font-mono">{d.event}</span>{" "}
                    <Badge tone={d.status === "failed" ? "danger" : "warn"}>{d.status}</Badge>
                    <p className="text-xs text-muted">
                      {d.attempts} attempt{d.attempts === 1 ? "" : "s"} · queued {timeAgo(d.createdAt)}
                      {d.lastError && ` · ${d.lastError}`}
                    </p>
                  </div>
                  {d.status === "failed" && (
                    <button className="btn-ghost" onClick={() => retry({ deliveryId: d._id })}>Retry</button>
                  )}
                </div>
              ))}
              {health.workflowErrors.map((e) => (
                <div key={e._id} className="card text-sm">
                  <Badge tone="danger">n8n error</Badge>{" "}
                  <span className="text-xs text-muted">{timeAgo(e.at)}</span>
                  <p className="mt-1 font-mono text-xs">{e.detail}</p>
                </div>
              ))}
            </>
          )}
        </Section>

        <Section title="All loans">
          {loans === undefined ? <Loading /> : loans.length === 0 ? <Empty>No loans yet.</Empty> : (
            <ul className="space-y-2">
              {loans.map((l) => (
                <li key={l._id} className="card">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span>
                      <span className="font-medium">{l.toolName}</span> · {l.lenderName} → {l.borrowerName} ·{" "}
                      {formatDate(l.startDate)} – {formatDate(l.endDate)}
                    </span>
                    <LoanStatus status={l.status} overdue={l.overdue} />
                  </div>
                  <Activity items={l.activity} />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Listings">
          {listings === undefined ? <Loading /> : listings.length === 0 ? <Empty>No listings.</Empty> : (
            <ul className="space-y-2">
              {listings.map((t) => (
                <li key={t._id} className="card flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    <span className="font-medium">{t.name}</span> · {categoryLabel(t.category)} · {t.ownerName}{" "}
                    {t.status === "on_loan" && <Badge tone="warn">On loan</Badge>}
                  </span>
                  <button className="btn-danger" disabled={t.status === "on_loan"}
                    title={t.status === "on_loan" ? "Mark it returned first" : undefined}
                    onClick={() => removeListing({ toolId: t._id })}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Lenders">
          {users === undefined ? <Loading /> : (
            <ul className="space-y-2">
              {users.map((u) => (
                <li key={u._id} className="card flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    <span className="font-medium">{u.name}</span> <span className="text-muted">{u.email}</span>{" "}
                    {u.role === "admin" && <Badge>admin</Badge>}{" "}
                    {u.trustedLender && <Badge tone="good">Trusted lender</Badge>}
                  </span>
                  <button className="btn-ghost" onClick={() => setTrusted({ userId: u._id, trusted: !u.trustedLender })}>
                    {u.trustedLender ? "Remove trusted" : "Mark trusted"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}

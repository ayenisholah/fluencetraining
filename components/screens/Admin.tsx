"use client";

import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { useState, type ReactNode } from "react";
import { activityText } from "@/components/LoanCard";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  ClockIcon,
  EmptyState,
  InboxIcon,
  PageHeader,
  SendIcon,
  ShieldIcon,
  Spinner,
  StatWidget,
  Toggle,
  WarningIcon,
} from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { categoryLabel, errorMessage, formatDate, timeAgo } from "@/lib/format";
import { loanStatusBadge } from "@/lib/loanStatus";

export const LOANS_PAGE_SIZE = 25;

export function AdminScreen() {
  const me = useQuery(api.users.me);
  if (me === undefined) return <Spinner />;
  if (me?.role !== "admin") return <EmptyState icon={<ShieldIcon />} title="Admins only" />;
  return <AdminDashboard />;
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card as="section">
      <CardHeader title={title} description={description} />
      {children}
    </Card>
  );
}

function AdminDashboard() {
  const stats = useQuery(api.admin.stats);
  const health = useQuery(api.admin.automationHealth);
  const { results: loans, status: loansStatus, loadMore } = usePaginatedQuery(
    api.admin.allLoans,
    {},
    { initialNumItems: LOANS_PAGE_SIZE },
  );
  const listings = useQuery(api.admin.listings);
  const users = useQuery(api.admin.users);
  const retry = useMutation(api.admin.retryDelivery);
  const removeListing = useMutation(api.admin.removeListing);
  const setTrusted = useMutation(api.admin.setTrustedLender);
  const [confirming, setConfirming] = useState<string>();
  const [error, setError] = useState<{ id: string; message: string }>();

  /** Runs an admin mutation and shows a refusal next to the row it came from. */
  const attempt = (id: string, fn: () => Promise<unknown>) => async () => {
    setError(undefined);
    try {
      await fn();
    } catch (err) {
      setError({ id, message: errorMessage(err) });
    }
  };
  const rowError = (id: string) =>
    error?.id === id && <Alert tone="danger" className="mt-2 w-full">{error.message}</Alert>;

  return (
    <>
      <PageHeader title="Admin" description="Moderation and automation health." />
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatWidget label="Open requests" value={stats?.openRequests ?? "–"} icon={<InboxIcon />} />
          <StatWidget label="Active loans" value={stats?.activeLoans ?? "–"} icon={<SendIcon />} />
          <StatWidget
            label="Overdue loans"
            value={stats?.overdueLoans ?? "–"}
            icon={<ClockIcon />}
            delta={stats ? { value: stats.overdueLoans ? "needs attention" : "all on time", direction: stats.overdueLoans ? "down" : "flat" } : undefined}
          />
          <StatWidget
            label="Failed webhooks"
            value={stats?.failedDeliveries ?? "–"}
            icon={<WarningIcon />}
            delta={stats ? { value: stats.failedDeliveries ? "retry below" : "all delivered", direction: stats.failedDeliveries ? "down" : "flat" } : undefined}
          />
        </div>

        <Section title="Automation health" description="Webhook deliveries that haven't succeeded, and n8n workflow errors.">
          {health === undefined ? (
            <Spinner />
          ) : health.deliveries.length === 0 && health.workflowErrors.length === 0 ? (
            <p className="text-body text-fg-muted">All webhooks delivered. No workflow errors.</p>
          ) : (
            <ul className="divide-y divide-line">
              {health.deliveries.map((d) => (
                <li key={d._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0 text-body">
                    <span className="font-semibold">{d.event}</span>{" "}
                    <Badge tone={d.status === "failed" ? "danger" : "warning"}>{d.status}</Badge>
                    <p className="mt-1 text-description text-fg-muted">
                      {d.attempts} attempt{d.attempts === 1 ? "" : "s"} · queued {timeAgo(d.createdAt)}
                      {d.lastError && ` · ${d.lastError}`}
                    </p>
                  </div>
                  {d.status === "failed" && (
                    <Button size="sm" variant="ghost" onClick={attempt(d._id, () => retry({ deliveryId: d._id }))}>Retry</Button>
                  )}
                  {rowError(d._id)}
                </li>
              ))}
              {health.workflowErrors.map((e) => (
                <li key={e._id} className="py-3 text-body">
                  <Badge tone="danger">n8n error</Badge>{" "}
                  <span className="text-description text-fg-muted">{timeAgo(e.at)}</span>
                  <p className="mt-1 text-description text-fg">{e.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="All loans">
          {loansStatus === "LoadingFirstPage" ? (
            <Spinner />
          ) : loans.length === 0 ? (
            <p className="text-body text-fg-muted">No loans yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {loans.map((l) => {
                const badge = loanStatusBadge(l.status, l.overdue);
                return (
                  <li key={l._id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-body">
                    <div className="min-w-0">
                      <span className="font-semibold">{l.toolName}</span>{" "}
                      <span className="text-fg-muted">
                        · {l.lenderName} → {l.borrowerName} · {formatDate(l.startDate)} – {formatDate(l.endDate)}
                      </span>
                      {l.activity[0] && <p className="mt-1 text-description text-fg-muted">{activityText(l.activity[0])}</p>}
                    </div>
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
          {(loansStatus === "CanLoadMore" || loansStatus === "LoadingMore") && (
            <Button
              size="sm"
              variant="ghost"
              className="mt-3"
              disabled={loansStatus === "LoadingMore"}
              onClick={() => loadMore(LOANS_PAGE_SIZE)}
            >
              {loansStatus === "LoadingMore" ? "Loading…" : "Load more loans"}
            </Button>
          )}
        </Section>

        <div className="grid gap-6 xl:grid-cols-2">
          <Section title="Listings">
            {listings === undefined ? (
              <Spinner />
            ) : listings.length === 0 ? (
              <p className="text-body text-fg-muted">No listings.</p>
            ) : (
              <ul className="divide-y divide-line">
                {listings.map((t) => (
                  <li key={t._id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-body">
                    <span className="min-w-0">
                      <span className="font-semibold">{t.name}</span>{" "}
                      <span className="text-fg-muted">· {categoryLabel(t.category)} · {t.ownerName}</span>{" "}
                      {t.status === "on_loan" && <Badge tone="warning">On loan</Badge>}
                    </span>
                    {confirming === t._id ? (
                      <span role="group" aria-label={`Remove ${t.name}?`} className="flex flex-wrap items-center gap-2">
                        <span className="text-description text-fg-muted">
                          {t.status === "on_loan" ? "It's on loan; the loan stays open." : "Open requests will be declined."}
                        </span>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={attempt(t._id, async () => {
                            setConfirming(undefined);
                            await removeListing({ toolId: t._id });
                          })}
                        >
                          Confirm remove
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirming(undefined)}>Keep</Button>
                      </span>
                    ) : (
                      <Button size="sm" variant="danger" aria-label={`Remove ${t.name}`} onClick={() => setConfirming(t._id)}>
                        Remove
                      </Button>
                    )}
                    {rowError(t._id)}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Members" description="Trusted lenders get a badge on their listings.">
            {users === undefined ? (
              <Spinner />
            ) : (
              <ul className="divide-y divide-line">
                {users.map((u) => (
                  <li key={u._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <span className="flex min-w-0 items-center gap-3">
                      <Avatar name={u.name} size={36} />
                      <span className="min-w-0">
                        <span className="block truncate text-body-bold text-fg">
                          {u.name} {u.role === "admin" && <Badge variant="ghost" tone="brand">admin</Badge>}
                        </span>
                        <span className="block truncate text-description text-fg-muted">{u.email}</span>
                      </span>
                    </span>
                    <Toggle
                      size="sm"
                      label={<><span className="sr-only">{`${u.name}:`}</span>{" "}Trusted</>}
                      checked={u.trustedLender}
                      onCheckedChange={(trusted) => void attempt(u._id, () => setTrusted({ userId: u._id, trusted }))()}
                    />
                    {rowError(u._id)}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}

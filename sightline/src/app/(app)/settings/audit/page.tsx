import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { recentEvents } from "@/lib/audit";
import { AccessDenied, Badge, Card, CardHead, EmptyState, PageHeader, StatTile } from "@/components/ui";
import { dateTimeLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

const tone = (action: string) =>
  action.startsWith("auth.failed") || action.includes("rate_limited")
    ? ("critical" as const)
    : action.startsWith("auth.")
      ? ("accent" as const)
      : action.includes("reclaim") || action.includes("delete")
        ? ("warning" as const)
        : ("neutral" as const);

export default async function AuditPage() {
  const user = await requireUser();
  if (!can(user, "audit.view")) return <AccessDenied what="the audit log" />;

  const events = recentEvents(user.orgId, 200);
  const failures = events.filter((event) => event.action === "auth.failed");
  const mutations = events.filter((event) => !event.action.startsWith("auth."));

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Audit log"
        sub="Every sign-in, failed attempt, permission denial and data change, with the actor and source address attached."
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatTile label="Events recorded" value={String(events.length)} hint="Most recent 200" />
        <StatTile label="Data changes" value={String(mutations.length)} hint="Vendor, seat, budget, renewal and user edits" />
        <StatTile
          label="Failed sign-ins"
          value={String(failures.length)}
          hint="Five consecutive failures locks an account for 15 minutes"
          tone={failures.length ? "warning" : undefined}
        />
      </div>

      <Card>
        <CardHead title="Recent activity" sub="Newest first. Retained for the life of the demo environment." />
        {events.length === 0 ? (
          <EmptyState title="No events yet" body="Activity appears here as soon as anyone signs in or changes a record." />
        ) : (
          <div className="tbl-scroll thin-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Detail</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td className="num whitespace-nowrap" style={{ color: "var(--ink-2)" }}>
                      {dateTimeLabel(event.createdAt)}
                    </td>
                    <td style={{ color: "var(--ink-2)" }}>{event.actorEmail ?? "anonymous"}</td>
                    <td>
                      <Badge tone={tone(event.action)}>{event.action}</Badge>
                    </td>
                    <td style={{ color: "var(--ink-3)" }}>
                      {event.entity}
                      {event.entityId ? (
                        <span className="block text-[11px]" style={{ color: "var(--ink-3)" }}>
                          {event.entityId}
                        </span>
                      ) : null}
                    </td>
                    <td style={{ color: "var(--ink-2)" }}>{event.detail ?? "—"}</td>
                    <td className="num" style={{ color: "var(--ink-3)" }}>
                      {event.ip ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

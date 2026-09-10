import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { can, departmentScope, ROLE_LABEL } from "@/lib/rbac";
import {
  currentMonth,
  dormantSeats,
  orgUsers,
  vendorById,
  vendorHistory,
  vendorInvoices,
} from "@/lib/queries";
import { LineChart, StackedColumns } from "@/components/charts";
import { seriesColor } from "@/lib/series";
import { ActionForm } from "@/components/action-form";
import { CsrfField } from "@/components/csrf";
import { saveVendor } from "@/app/(app)/actions";
import {
  Badge,
  Card,
  CardHead,
  Meter,
  StatTile,
  StatusBadge,
  VendorMark,
  renewalTone,
  riskTone,
  utilizationTone,
} from "@/components/ui";
import {
  compactMoney,
  dateLabel,
  daysUntil,
  money,
  moneyExact,
  monthLabel,
  percent,
  relativeDays,
} from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const user = await requireUser();
  const { id } = await params;
  const vendor = vendorById({ orgId: user.orgId, deptId: departmentScope(user) }, id);
  return { title: vendor?.name ?? "Vendor" };
}

export default async function VendorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const scope = { orgId: user.orgId, deptId: departmentScope(user) };
  const month = currentMonth();

  const vendor = vendorById(scope, id, month);
  if (!vendor) notFound();

  const history = vendorHistory(vendor.id, 24);
  const invoices = vendorInvoices(vendor.id, 12);
  const seats = dormantSeats(scope, { vendorId: vendor.id, limit: 8 });
  const owners = can(user, "vendor.edit") ? orgUsers(user.orgId) : [];

  const ratio = vendor.provisioned ? vendor.active / vendor.provisioned : 0;
  const days = vendor.termEnd ? daysUntil(vendor.termEnd) : null;
  const noticeDays = days !== null ? days - (vendor.noticeDays ?? 0) : null;
  const seatGap = (vendor.provisioned ?? 0) - (vendor.committedSeats ?? 0);

  return (
    <>
      <nav className="mb-4 text-[12px]" style={{ color: "var(--ink-3)" }}>
        <Link href="/vendors" className="hover:underline">
          Vendors
        </Link>
        <span aria-hidden> / </span>
        <span style={{ color: "var(--ink-2)" }}>{vendor.name}</span>
      </nav>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <VendorMark name={vendor.name} hue={vendor.accentHue} size={44} />
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.02em]" style={{ color: "var(--ink)" }}>
              {vendor.name}
            </h1>
            <p className="mt-0.5 text-[13px]" style={{ color: "var(--ink-2)" }}>
              {vendor.category} · {vendor.planName ?? "No plan on file"} · owned by {vendor.ownerName ?? "unassigned"}
              {vendor.department ? ` (${vendor.department})` : ""}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <StatusBadge tone={riskTone(vendor.riskTier)} label={`${vendor.riskTier} risk`} />
              <Badge tone="neutral">{vendor.dataClassification} data</Badge>
              <Badge tone={vendor.ssoEnforced ? "good" : "warning"}>{vendor.ssoEnforced ? "SSO enforced" : "No SSO"}</Badge>
              <Badge tone={vendor.scimEnabled ? "good" : "neutral"}>{vendor.scimEnabled ? "SCIM provisioning" : "Manual provisioning"}</Badge>
              {vendor.autoRenew ? <Badge tone="warning">Auto-renews</Badge> : <Badge tone="neutral">Manual renewal</Badge>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a className="btn btn-sm" href={vendor.website} target="_blank" rel="noreferrer noopener">
            Vendor site ↗
          </a>
          <Link className="btn btn-sm" href={`/seats?vendor=${vendor.id}`}>
            Seat detail
          </Link>
        </div>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label={`Billed ${monthLabel(month, "long")}`}
          value={money(vendor.monthCents)}
          hint={`${compactMoney(vendor.monthCents * 12)} annualised`}
          spark={history.slice(-12).map((point) => point.totalCents)}
        />
        <StatTile
          label="Seat utilisation"
          value={percent(ratio)}
          hint={`${vendor.active.toLocaleString("en-US")} active of ${vendor.provisioned.toLocaleString("en-US")} provisioned`}
          spark={history.slice(-12).map((point) => (point.provisioned ? point.active / point.provisioned : 0))}
          sparkColor={ratio >= 0.8 ? "var(--good)" : "var(--series-2)"}
        />
        <StatTile
          label="Dormant seats"
          value={vendor.dormant.toLocaleString("en-US")}
          hint={`${compactMoney(vendor.dormantCostCents * 12)} a year idle 30+ days`}
          tone={vendor.dormantCostCents > 0 ? "critical" : undefined}
        />
        <StatTile
          label="Renewal"
          value={days !== null ? relativeDays(days) : "—"}
          hint={
            vendor.termEnd
              ? `${dateLabel(vendor.termEnd)} · notice ${noticeDays !== null && noticeDays <= 0 ? "window closed" : `by ${relativeDays(noticeDays ?? 0)}`}`
              : "No contract on file"
          }
          tone={days !== null && days <= 90 ? "critical" : undefined}
        />
      </div>

      <div className="mb-4 grid items-start gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHead title="Billing history" sub="Committed spend versus billed overage, trailing 24 months." />
          <div className="px-2 pb-3">
            <StackedColumns
              months={history.map((point) => point.month)}
              series={[
                { key: "base", label: "Committed spend", color: seriesColor(0) },
                { key: "overage", label: "Overage", color: seriesColor(1) },
              ]}
              data={history.map((point) => ({
                base: point.totalCents - point.overageCents,
                overage: point.overageCents,
              }))}
              format="compactMoney"
              height={264}
              tableLabel="billing history"
            />
          </div>
        </Card>

        <Card>
          <CardHead title="Contract terms" sub={vendor.planName ?? undefined} />
          <dl className="px-5 pb-5 text-[13px]">
            {[
              ["Term ends", vendor.termEnd ? dateLabel(vendor.termEnd) : "—"],
              ["Notice period", vendor.noticeDays ? `${vendor.noticeDays} days` : "—"],
              ["Renewal", vendor.autoRenew ? "Automatic" : "Manual"],
              ["Committed seats", vendor.committedSeats?.toLocaleString("en-US") ?? "—"],
              ["Provisioned seats", vendor.provisioned.toLocaleString("en-US")],
              [
                "Seat position",
                seatGap === 0
                  ? "At commitment"
                  : seatGap > 0
                    ? `${seatGap.toLocaleString("en-US")} over commitment`
                    : `${Math.abs(seatGap).toLocaleString("en-US")} unused commitment`,
              ],
              ["Unit price", vendor.unitPriceCents ? `${moneyExact(vendor.unitPriceCents)} / seat / month` : "Platform fee only"],
              ["Overage rate", vendor.overageUnitPriceCents ? `${moneyExact(vendor.overageUnitPriceCents)} / seat / month` : "—"],
              ["Annual commitment", vendor.annualCommitCents ? money(vendor.annualCommitCents) : "—"],
              ["Renewal uplift asked", vendor.uplift ? `+${Math.round(vendor.uplift * 100)}%` : "None on file"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-4 border-b py-2 last:border-0" style={{ borderColor: "var(--line)" }}>
                <dt style={{ color: "var(--ink-3)" }}>{label}</dt>
                <dd className="num text-right font-medium" style={{ color: "var(--ink)" }}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <div className="mb-4 grid items-start gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHead title="Seats provisioned versus active" sub="Trailing 24 months." />
          <div className="px-2 pb-3">
            <LineChart
              months={history.map((point) => point.month)}
              series={[
                { key: "prov", label: "Provisioned", color: seriesColor(0), values: history.map((p) => p.provisioned) },
                { key: "act", label: "Active (30d)", color: seriesColor(2), values: history.map((p) => p.active) },
              ]}
              height={244}
              format="number"
              tableLabel="seat counts"
            />
          </div>
        </Card>

        <Card>
          <CardHead
            title="Dormant seats"
            sub={`${vendor.dormant} seats with no activity in 30+ days.`}
            action={
              vendor.dormant > 0 ? (
                <Link href={`/seats?vendor=${vendor.id}`} className="btn btn-sm">
                  Reclaim
                </Link>
              ) : null
            }
          />
          <ul className="px-5 pb-5">
            {seats.map((seat) => (
              <li key={seat.id} className="flex items-center justify-between gap-3 border-b py-2.5 last:border-0" style={{ borderColor: "var(--line)" }}>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                    {seat.employeeName}
                  </p>
                  <p className="truncate text-[11px]" style={{ color: "var(--ink-3)" }}>
                    {seat.department} · {seat.employeeStatus === "offboarded" ? "offboarded" : `idle ${seat.idleDays ?? "?"}d`}
                  </p>
                </div>
                <span className="num shrink-0 text-[12px]" style={{ color: "var(--ink-2)" }}>
                  {moneyExact(seat.monthlyCostCents)}/mo
                </span>
              </li>
            ))}
            {seats.length === 0 ? (
              <li className="py-6 text-center text-[13px]" style={{ color: "var(--ink-3)" }}>
                Every seat has been active in the last 30 days.
              </li>
            ) : null}
          </ul>
        </Card>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHead title="Invoices" sub="Most recent 12 billing periods." />
          <div className="tbl-scroll thin-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Issued</th>
                  <th className="r">Base</th>
                  <th className="r">Overage</th>
                  <th className="r">Credits</th>
                  <th className="r">Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="font-medium">{monthLabel(invoice.periodMonth, "long")}</td>
                    <td style={{ color: "var(--ink-3)" }}>{dateLabel(invoice.issuedAt)}</td>
                    <td className="r num">{money(invoice.baseCents)}</td>
                    <td className="r num" style={{ color: invoice.overageCents ? "var(--critical-ink)" : "var(--ink-3)" }}>
                      {invoice.overageCents ? money(invoice.overageCents) : "—"}
                    </td>
                    <td className="r num" style={{ color: invoice.creditsCents ? "var(--good-ink)" : "var(--ink-3)" }}>
                      {invoice.creditsCents ? `−${money(invoice.creditsCents)}` : "—"}
                    </td>
                    <td className="r num font-semibold">{money(invoice.totalCents)}</td>
                    <td>
                      <StatusBadge
                        tone={invoice.status === "paid" ? "good" : invoice.status === "open" ? "warning" : "critical"}
                        label={invoice.status}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHead title="Vendor record" sub={can(user, "vendor.edit") ? "Changes are written to the audit log." : "Read-only for your role."} />
          <div className="px-5 pb-5">
            {can(user, "vendor.edit") ? (
              <ActionForm action={saveVendor} submitLabel="Save vendor">
                <CsrfField />
                <input type="hidden" name="vendorId" value={vendor.id} />
                <label className="label mt-1">Business owner</label>
                <select name="ownerUserId" defaultValue={vendor.ownerUserId ?? ""} className="field h-9 text-[13px]">
                  <option value="">Unassigned</option>
                  {owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.name} — {ROLE_LABEL[owner.role as keyof typeof ROLE_LABEL]}
                    </option>
                  ))}
                </select>

                <label className="label mt-3">Lifecycle status</label>
                <select name="status" defaultValue={vendor.status} className="field h-9 text-[13px]">
                  <option value="active">Active</option>
                  <option value="in_negotiation">In negotiation</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="unsanctioned">Unsanctioned</option>
                </select>

                <label className="label mt-3">Risk tier</label>
                <select name="riskTier" defaultValue={vendor.riskTier} className="field h-9 text-[13px]">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>

                <label className="label mt-3">Notes</label>
                <textarea
                  name="notes"
                  rows={3}
                  defaultValue={vendor.notes ?? ""}
                  placeholder="Negotiation history, consolidation plan, security review reference…"
                  className="field h-auto py-2 text-[13px]"
                />
              </ActionForm>
            ) : (
              <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>
                Vendor records are editable by administrators and IT operations. Ask your Sightline administrator for
                access if you need to change the owner or risk tier.
              </p>
            )}

            <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--line)" }}>
              <p className="eyebrow mb-2">Utilisation</p>
              <div className="flex items-center gap-3">
                <span className="num text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
                  {percent(ratio)}
                </span>
                <span className="flex-1">
                  <Meter ratio={ratio} tone={utilizationTone(ratio)} />
                </span>
              </div>
              {days !== null ? (
                <p className="mt-3 text-[12px]" style={{ color: "var(--ink-3)" }}>
                  Renewal <Badge tone={renewalTone(days)}>{relativeDays(days)}</Badge>
                </p>
              ) : null}
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

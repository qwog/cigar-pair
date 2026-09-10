import Link from "next/link";
import type { Metadata } from "next";
import { currentCsrfToken, requireUser } from "@/lib/auth";
import { can, departmentScope } from "@/lib/rbac";
import { currentMonth, dormantSeats, headline, reclaimTargets, seatTrend, vendorRows } from "@/lib/queries";
import { LineChart } from "@/components/charts";
import { seriesColor } from "@/lib/series";
import { Card, CardHead, EmptyState, Meter, PageHeader, StatTile, VendorMark } from "@/components/ui";
import { FilterBar, Field } from "@/components/filter-bar";
import { SeatReclaimTable } from "./seat-table";
import { compactMoney, compactNumber, money, percent } from "@/lib/format";

export const metadata: Metadata = { title: "Seats & licences" };
export const dynamic = "force-dynamic";

type Search = { vendor?: string; idle?: string; offboarded?: string };

export default async function SeatsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const params = await searchParams;
  const scope = { orgId: user.orgId, deptId: departmentScope(user) };
  const month = currentMonth();

  const head = headline(scope, month);
  const targets = reclaimTargets(scope, month);
  const vendors = vendorRows(scope, month);
  const trend = seatTrend(scope, 12);
  const csrf = await currentCsrfToken();

  const minIdle = Number(params.idle ?? 30) || 30;
  const rows = dormantSeats(scope, {
    vendorId: params.vendor,
    minIdleDays: minIdle,
    offboardedOnly: params.offboarded === "1",
    limit: 300,
  });

  const offboardedHolding = targets.reduce((sum, target) => sum + target.offboarded, 0);
  const selectedVendor = params.vendor ? vendors.find((vendor) => vendor.id === params.vendor) : undefined;
  const visibleAnnual = rows.reduce((sum, row) => sum + row.monthlyCostCents * 12, 0);

  return (
    <>
      <PageHeader
        eyebrow="Optimise"
        title="Seats & licences"
        sub="Every provisioned seat reconciled against the last 30 days of activity. Reclaiming a seat marks it for removal at the next true-up and records the saving."
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Seats provisioned"
          value={compactNumber(head.seatsProvisioned)}
          hint={`Across ${vendors.filter((vendor) => vendor.provisioned > 0).length} vendors`}
        />
        <StatTile
          label="Active in last 30 days"
          value={compactNumber(head.seatsActive)}
          hint={`${percent(head.seatsProvisioned ? head.seatsActive / head.seatsProvisioned : 0)} utilisation`}
        />
        <StatTile
          label="Dormant seats"
          value={compactNumber(head.dormantSeats)}
          hint={`${offboardedHolding.toLocaleString("en-US")} still held by offboarded staff`}
          tone={head.dormantSeats > 0 ? "critical" : undefined}
        />
        <StatTile
          label="Recoverable per year"
          value={compactMoney(head.dormantAnnualCents)}
          hint="At current unit pricing, if every dormant seat is removed"
        />
      </div>

      <div className="mb-4 grid items-start gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHead
            title="Where the waste is"
            sub="Vendors ranked by the annual cost of seats idle 30+ days."
          />
          <div className="tbl-scroll thin-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th className="r">Seats</th>
                  <th className="r">Dormant</th>
                  <th style={{ width: 108 }}>Share</th>
                  <th className="r">Ex-staff</th>
                  <th className="r">Waste / yr</th>
                </tr>
              </thead>
              <tbody>
                {targets.slice(0, 12).map((target) => {
                  const share = target.provisioned ? target.dormant / target.provisioned : 0;
                  return (
                    <tr key={target.vendorId}>
                      <td>
                        <Link href={`/seats?vendor=${target.vendorId}`} className="flex items-center gap-2.5 whitespace-nowrap font-medium">
                          <VendorMark name={target.vendorName} hue={target.accentHue} size={24} />
                          {target.vendorName}
                        </Link>
                      </td>
                      <td className="r num" style={{ color: "var(--ink-2)" }}>
                        {target.provisioned.toLocaleString("en-US")}
                      </td>
                      <td className="r num font-semibold">{target.dormant.toLocaleString("en-US")}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="num w-9 shrink-0 text-[12px]" style={{ color: "var(--ink-2)" }}>
                            {percent(share)}
                          </span>
                          <span className="flex-1">
                            <Meter ratio={share} tone={share > 0.4 ? "critical" : share > 0.2 ? "warning" : "accent"} />
                          </span>
                        </div>
                      </td>
                      <td className="r num" style={{ color: target.offboarded ? "var(--critical-ink)" : "var(--ink-3)" }}>
                        {target.offboarded || "—"}
                      </td>
                      <td className="r num font-semibold">{money(target.monthlyWasteCents * 12)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHead title="Provisioned versus active" sub="Trailing 12 months, whole portfolio." />
          <div className="px-2 pb-3">
            <LineChart
              months={trend.map((point) => point.month)}
              series={[
                { key: "prov", label: "Provisioned", color: seriesColor(0), values: trend.map((p) => p.provisioned) },
                { key: "act", label: "Active (30d)", color: seriesColor(2), values: trend.map((p) => p.active) },
              ]}
              height={210}
              format="number"
              tableLabel="seat counts"
            />
          </div>
        </Card>
      </div>

      <FilterBar
        action="/seats"
        hint={`${rows.length} seats shown · ${money(visibleAnnual)} a year`}
      >
        <Field label="Vendor" name="vendor" width={210}>
          <select name="vendor" defaultValue={params.vendor ?? ""} className="field h-9 text-[13px]">
            <option value="">All vendors</option>
            {targets.map((target) => (
              <option key={target.vendorId} value={target.vendorId}>
                {target.vendorName} ({target.dormant})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Idle for at least" name="idle" width={150}>
          <select name="idle" defaultValue={String(minIdle)} className="field h-9 text-[13px]">
            <option value="30">30 days</option>
            <option value="60">60 days</option>
            <option value="90">90 days</option>
            <option value="120">120 days</option>
          </select>
        </Field>
        <Field label="Employment" name="offboarded" width={170}>
          <select name="offboarded" defaultValue={params.offboarded ?? ""} className="field h-9 text-[13px]">
            <option value="">Everyone</option>
            <option value="1">Offboarded only</option>
          </select>
        </Field>
      </FilterBar>

      <Card>
        <CardHead
          title={selectedVendor ? `${selectedVendor.name} dormant seats` : "Dormant seats"}
          sub={
            can(user, "seat.reclaim")
              ? "Select seats and reclaim them. The change is written to the audit log with the saving attached."
              : "Reclaiming seats requires an administrator or IT operations role."
          }
          action={
            selectedVendor ? (
              <Link href="/seats" className="btn btn-sm">
                All vendors
              </Link>
            ) : null
          }
        />
        {rows.length === 0 ? (
          <EmptyState
            title="Nothing dormant under these filters"
            body="Every seat in this slice has been used inside the idle window you selected."
          />
        ) : (
          <SeatReclaimTable rows={rows} csrf={csrf} canReclaim={can(user, "seat.reclaim")} />
        )}
      </Card>
    </>
  );
}

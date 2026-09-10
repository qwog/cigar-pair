import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { departmentScope } from "@/lib/rbac";
import { commitments, currentMonth, headline, spendTrend } from "@/lib/queries";
import { StackedColumns } from "@/components/charts";
import { seriesColor } from "@/lib/series";
import { Badge, Card, CardHead, EmptyState, Meter, PageHeader, StatTile, StatusBadge, VendorMark } from "@/components/ui";
import { compactMoney, dateLabel, daysUntil, money, moneyExact, monthLabel, percent, relativeDays } from "@/lib/format";

export const metadata: Metadata = { title: "Overages" };
export const dynamic = "force-dynamic";

export default async function OveragesPage() {
  const user = await requireUser();
  const scope = { orgId: user.orgId, deptId: departmentScope(user) };
  const month = currentMonth();

  const head = headline(scope, month);
  const trend = spendTrend(scope, 12);
  const rows = commitments(scope, month);

  const overRows = rows.filter((row) => row.trailingOverageCents > 0);
  const underRows = rows
    .filter((row) => row.committedSeats > row.provisioned && row.unitPriceCents > 0)
    .map((row) => ({ ...row, unusedSeats: row.committedSeats - row.provisioned }))
    .sort((a, b) => b.unusedSeats * b.unitPriceCents - a.unusedSeats * a.unitPriceCents);

  const shelfwareAnnual = underRows.reduce((sum, row) => sum + row.unusedSeats * row.unitPriceCents * 12, 0);

  /** What the same seats would cost inside the commitment rather than at overage rates. */
  const premium = overRows.reduce((sum, row) => {
    const extra = Math.max(0, row.provisioned - row.committedSeats);
    return sum + extra * Math.max(0, row.overageUnitPriceCents - row.unitPriceCents) * 12;
  }, 0);

  return (
    <>
      <PageHeader
        eyebrow="Optimise"
        title="Overages & commitments"
        sub="Where seat counts have drifted past what the contract covers — and where you are paying for commitment nobody is using."
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Overage this month"
          value={money(head.overageMonthCents)}
          hint={`${overRows.filter((row) => row.monthOverageCents > 0).length} vendors billed above commitment`}
          tone={head.overageMonthCents > 0 ? "critical" : undefined}
        />
        <StatTile
          label="Overage, trailing 12"
          value={compactMoney(head.overageTrailingCents)}
          hint={`${percent(head.annualRunRateCents ? head.overageTrailingCents / head.annualRunRateCents : 0, 1)} of annual run-rate`}
          spark={trend.map((point) => point.overageCents)}
          sparkColor="var(--series-2)"
        />
        <StatTile
          label="Avoidable rate premium"
          value={compactMoney(premium)}
          hint="Annual cost of buying those seats at overage rates instead of raising the commitment"
        />
        <StatTile
          label="Shelfware"
          value={compactMoney(shelfwareAnnual)}
          hint={`${underRows.length} contracts committed above what is provisioned`}
        />
      </div>

      <Card className="mb-4">
        <CardHead
          title="Committed spend versus overage"
          sub="Overage is billed at a higher unit rate than committed seats — a persistent band here is a renegotiation trigger."
        />
        <div className="px-2 pb-3">
          <StackedColumns
            months={trend.map((point) => point.month)}
            series={[
              { key: "base", label: "Committed spend", color: seriesColor(0) },
              { key: "overage", label: "Overage", color: seriesColor(1) },
            ]}
            data={trend.map((point) => ({ base: point.baseCents, overage: point.overageCents }))}
            format="compactMoney"
            height={260}
            tableLabel="committed spend and overage"
          />
        </div>
      </Card>

      <Card className="mb-4">
        <CardHead
          title="Billing above commitment"
          sub="Sorted by trailing-12 overage. Recommendation compares the overage rate against the committed unit price."
        />
        {overRows.length === 0 ? (
          <EmptyState title="No overage in the last 12 months" body="Every vendor stayed inside its committed seat count." />
        ) : (
          <div className="tbl-scroll thin-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th className="r">Committed</th>
                  <th className="r">Provisioned</th>
                  <th style={{ width: 130 }}>Over commitment</th>
                  <th className="r">Unit / overage</th>
                  <th className="r">This month</th>
                  <th className="r">Trailing 12</th>
                  <th>Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {overRows.map((row) => {
                  const extra = Math.max(0, row.provisioned - row.committedSeats);
                  const over = row.committedSeats ? extra / row.committedSeats : 0;
                  const persistent = row.overageMonths >= 6;
                  const days = daysUntil(row.termEnd);
                  return (
                    <tr key={row.vendorId}>
                      <td>
                        <Link href={`/vendors/${row.vendorId}`} className="flex items-center gap-2.5 font-medium">
                          <VendorMark name={row.vendorName} hue={row.accentHue} size={24} />
                          <span>
                            {row.vendorName}
                            <span className="block text-[11px]" style={{ color: "var(--ink-3)" }}>
                              {row.department ?? row.category}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="r num" style={{ color: "var(--ink-2)" }}>
                        {row.committedSeats.toLocaleString("en-US")}
                      </td>
                      <td className="r num font-semibold">{row.provisioned.toLocaleString("en-US")}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="num w-11 shrink-0 text-[12px]" style={{ color: "var(--ink-2)" }}>
                            +{extra.toLocaleString("en-US")}
                          </span>
                          <span className="flex-1">
                            <Meter ratio={Math.min(1, over * 3)} tone={over > 0.15 ? "critical" : "warning"} />
                          </span>
                        </div>
                      </td>
                      <td className="r num" style={{ color: "var(--ink-2)" }}>
                        {moneyExact(row.unitPriceCents)} / {moneyExact(row.overageUnitPriceCents)}
                      </td>
                      <td className="r num">
                        {row.monthOverageCents ? money(row.monthOverageCents) : <span style={{ color: "var(--ink-3)" }}>—</span>}
                      </td>
                      <td className="r num font-semibold" style={{ color: "var(--critical-ink)" }}>
                        {money(row.trailingOverageCents)}
                      </td>
                      <td>
                        <StatusBadge
                          tone={persistent ? "critical" : "warning"}
                          label={persistent ? "Raise commitment" : "Watch"}
                        />
                        <span className="mt-1 block text-[11px]" style={{ color: "var(--ink-3)" }}>
                          {row.overageMonths} of last 12 months · renews {relativeDays(days)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHead
          title="Shelfware — commitment nobody is using"
          sub="Seats you have contracted for but never provisioned. These are the first thing to hand back at renewal."
        />
        {underRows.length === 0 ? (
          <EmptyState title="No unused commitment" body="Every contracted seat has been provisioned to someone." />
        ) : (
          <div className="tbl-scroll thin-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th className="r">Committed</th>
                  <th className="r">Provisioned</th>
                  <th className="r">Unused</th>
                  <th style={{ width: 140 }}>Share unused</th>
                  <th className="r">Annual cost</th>
                  <th>Renews</th>
                </tr>
              </thead>
              <tbody>
                {underRows.slice(0, 15).map((row) => {
                  const share = row.committedSeats ? row.unusedSeats / row.committedSeats : 0;
                  const days = daysUntil(row.termEnd);
                  return (
                    <tr key={row.vendorId}>
                      <td>
                        <Link href={`/vendors/${row.vendorId}`} className="flex items-center gap-2.5 font-medium">
                          <VendorMark name={row.vendorName} hue={row.accentHue} size={24} />
                          {row.vendorName}
                        </Link>
                      </td>
                      <td className="r num" style={{ color: "var(--ink-2)" }}>
                        {row.committedSeats.toLocaleString("en-US")}
                      </td>
                      <td className="r num" style={{ color: "var(--ink-2)" }}>
                        {row.provisioned.toLocaleString("en-US")}
                      </td>
                      <td className="r num font-semibold">{row.unusedSeats.toLocaleString("en-US")}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="num w-9 shrink-0 text-[12px]" style={{ color: "var(--ink-2)" }}>
                            {percent(share)}
                          </span>
                          <span className="flex-1">
                            <Meter ratio={share} tone={share > 0.25 ? "critical" : share > 0.12 ? "warning" : "accent"} />
                          </span>
                        </div>
                      </td>
                      <td className="r num font-semibold">{money(row.unusedSeats * row.unitPriceCents * 12)}</td>
                      <td>
                        <Badge tone={days <= 90 ? "serious" : "neutral"}>{relativeDays(days)}</Badge>
                        <span className="mt-0.5 block text-[11px]" style={{ color: "var(--ink-3)" }}>
                          {dateLabel(row.termEnd)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { can, departmentScope } from "@/lib/rbac";
import {
  budgets,
  currentMonth,
  headline,
  reclaimTargets,
  renewals,
  savingsLevers,
  seatTrend,
  shadowIt,
  spendByCategory,
  spendTrend,
  vendorRows,
} from "@/lib/queries";
import { LineChart, RunwayChart, Sparkline, StackedColumns, BarList } from "@/components/charts";
import { seriesColor } from "@/lib/series";
import {
  Badge,
  Card,
  CardHead,
  Meter,
  PageHeader,
  StatTile,
  StatusBadge,
  VendorMark,
  renewalTone,
  utilizationTone,
} from "@/components/ui";
import {
  compactMoney,
  compactNumber,
  dateLabel,
  daysUntil,
  money,
  monthLabel,
  percent,
  relativeDays,
  signedPercent,
} from "@/lib/format";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const scope = { orgId: user.orgId, deptId: departmentScope(user) };
  const month = currentMonth();

  const head = headline(scope, month);
  const trend = spendTrend(scope, 12);
  const seats = seatTrend(scope, 12);
  const categories = spendByCategory(scope, month);
  const vendors = vendorRows(scope, month);
  const upcoming = renewals(scope, 365, month);
  const levers = savingsLevers(scope, month);
  const targets = reclaimTargets(scope, month);
  const findings = shadowIt(scope);
  const departments = budgets(scope, month);

  const utilisation = head.seatsProvisioned ? head.seatsActive / head.seatsProvisioned : 0;
  const budgetRatio = head.budgetCents ? head.annualRunRateCents / head.budgetCents : 0;

  // Renewal runway: contract value falling due, bucketed by month, next 12 months.
  const runway = Array.from({ length: 12 }, (_, i) => {
    const date = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + i, 1));
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const inMonth = upcoming.filter((row) => row.termEnd.slice(0, 7) === key);
    return {
      month: key,
      cents: inMonth.reduce((sum, row) => sum + row.annualCommitCents, 0),
      count: inMonth.length,
    };
  });

  const totalLevers =
    levers.reclaimCents + levers.negotiationCents + levers.duplicateCents + levers.shelfwareCents;

  const attention = [
    ...upcoming
      .filter((row) => row.autoRenew && row.daysToNotice <= 21)
      .slice(0, 4)
      .map((row) => ({
        tone: row.daysToNotice <= 7 ? ("critical" as const) : ("serious" as const),
        title: `${row.vendorName} auto-renews ${relativeDays(row.daysToRenewal)}`,
        body: `${row.daysToNotice <= 0 ? "Notice window has closed" : `Notice window closes ${relativeDays(row.daysToNotice)}`} · ${money(row.annualCommitCents)} committed · vendor asking +${Math.round(row.uplift * 100)}%`,
        href: `/renewals#${row.contractId}`,
        cta: "Open renewal",
      })),
    ...targets.slice(0, 3).map((target) => ({
      tone: "warning" as const,
      title: `${target.dormant} dormant ${target.vendorName} seats`,
      body: `${target.offboarded} belong to offboarded staff · ${money(target.monthlyWasteCents * 12)} a year`,
      href: `/seats?vendor=${target.vendorId}`,
      cta: "Review seats",
    })),
    ...findings
      .filter((finding) => finding.riskScore >= 70 && finding.status === "new")
      .slice(0, 2)
      .map((finding) => ({
        tone: "critical" as const,
        title: `${finding.appName} discovered via ${finding.source.replace("_", " ")}`,
        body: `${finding.userCount} users · risk ${finding.riskScore}/100 · ${finding.dataScopes ?? "scope unknown"}`,
        href: "/shadow-it",
        cta: "Triage",
      })),
  ].slice(0, 7);

  const topVendors = vendors.slice(0, 8);

  return (
    <>
      <PageHeader
        eyebrow={`Billing period ${monthLabel(month, "long")}`}
        title={scope.deptId ? `${user.departmentName} SaaS portfolio` : "Portfolio overview"}
        sub={
          scope.deptId
            ? "Every figure below covers the vendors your department owns. Company-wide totals sit outside your scope."
            : "Every vendor, seat, invoice and renewal date across the company, reconciled to the current billing period."
        }
        actions={
          can(user, "export.data") ? (
            <a className="btn btn-sm" href="/api/export/vendors" download>
              Export CSV
            </a>
          ) : null
        }
      />

      {/* Hero band ------------------------------------------------------ */}
      <Card className="mb-4 overflow-hidden">
        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
            <div>
              <p className="eyebrow">Annualised run-rate</p>
              <p
                className="mt-2 text-[48px] font-semibold leading-none tracking-[-0.03em]"
                style={{ color: "var(--ink)" }}
              >
                {compactMoney(head.annualRunRateCents)}
              </p>
              <p className="mt-2.5 text-[13px]" style={{ color: "var(--ink-3)" }}>
                <span
                  className="num font-semibold"
                  style={{ color: head.momDelta <= 0 ? "var(--good-ink)" : "var(--critical-ink)" }}
                >
                  {head.momDelta >= 0 ? "▲" : "▼"} {signedPercent(head.momDelta)}
                </span>{" "}
                versus last month · {signedPercent(head.yoyDelta)} year on year
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:border-l lg:pl-6" style={{ borderColor: "var(--line)" }}>
              {[
                { label: "This month", value: money(head.monthlySpendCents) },
                { label: "Vendors billed", value: String(head.vendorCount) },
                { label: "Per employee / yr", value: money(head.spendPerEmployeeCents) },
                { label: "Seats provisioned", value: compactNumber(head.seatsProvisioned) },
                { label: "Employees", value: compactNumber(head.employees) },
                {
                  label: "Against budget",
                  value: head.budgetCents ? percent(budgetRatio) : "—",
                },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-[11px]" style={{ color: "var(--ink-3)" }}>
                    {item.label}
                  </dt>
                  <dd className="num mt-0.5 text-[16px] font-semibold" style={{ color: "var(--ink)" }}>
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="lg:pl-6" style={{ minWidth: 190 }}>
            <p className="text-[11px]" style={{ color: "var(--ink-3)" }}>
              Monthly spend, trailing 12
            </p>
            <div className="mt-2">
              <Sparkline values={trend.map((point) => point.totalCents)} width={190} height={54} />
            </div>
          </div>
        </div>
      </Card>

      {/* Stat tiles ----------------------------------------------------- */}
      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Seat utilisation"
          value={percent(utilisation)}
          hint={`${compactNumber(head.seatsActive)} of ${compactNumber(head.seatsProvisioned)} seats active in the last 30 days`}
          spark={seats.map((point) => (point.provisioned ? point.active / point.provisioned : 0))}
          sparkColor={utilisation >= 0.8 ? "var(--good)" : "var(--series-2)"}
          href="/seats"
        />
        <StatTile
          label="Dormant seat spend"
          value={compactMoney(head.dormantAnnualCents)}
          hint={`${compactNumber(head.dormantSeats)} seats idle 30+ days across ${targets.length} vendors`}
          tone={head.dormantAnnualCents > 0 ? "critical" : undefined}
          href="/seats"
        />
        <StatTile
          label="Overage, trailing 12"
          value={compactMoney(head.overageTrailingCents)}
          hint={`${money(head.overageMonthCents)} billed above commitment this month`}
          spark={trend.map((point) => point.overageCents)}
          sparkColor="var(--series-2)"
          href="/overages"
        />
        <StatTile
          label="Renewals in 90 days"
          value={String(head.renewals90)}
          hint={`${money(head.renewals90ValueCents)} of committed value up for decision`}
          tone={head.renewals90 > 0 ? "critical" : undefined}
          href="/renewals"
        />
      </div>

      {/* Charts --------------------------------------------------------- */}
      <div className="mb-4 grid items-start gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHead
            title="Spend by month"
            sub="Committed subscription spend versus what was billed above commitment."
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
              height={300}
              tableLabel="monthly spend"
            />
          </div>
        </Card>

        <Card>
          <CardHead title="Spend by category" sub={`${monthLabel(month, "long")}, all billed vendors.`} />
          <div className="px-5 pb-4">
            <BarList
              items={categories.slice(0, 8).map((category) => ({
                label: category.category,
                value: category.cents,
                hint: `${category.vendors} vendor${category.vendors === 1 ? "" : "s"}`,
              }))}
              tableLabel="category spend"
            />
          </div>
        </Card>
      </div>

      <div className="mb-4 grid items-start gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHead
            title="Seats provisioned versus active"
            sub="The gap is what you are paying for and nobody is using."
          />
          <div className="px-2 pb-3">
            <LineChart
              months={seats.map((point) => point.month)}
              series={[
                { key: "prov", label: "Provisioned", color: seriesColor(0), values: seats.map((p) => p.provisioned) },
                { key: "act", label: "Active (30d)", color: seriesColor(2), values: seats.map((p) => p.active) },
              ]}
              format="number"
              height={300}
              tableLabel="seat counts"
            />
          </div>
        </Card>

        <Card>
          <CardHead
            title="Savings on the table"
            sub={`${compactMoney(totalLevers)} identified, annualised.`}
          />
          <div className="px-5 pb-5">
            <ul className="space-y-3">
              {[
                { label: "Reclaim dormant seats", cents: levers.reclaimCents, href: "/seats" },
                { label: "Renewal negotiation targets", cents: levers.negotiationCents, href: "/renewals" },
                { label: "Duplicate/overlapping tools", cents: levers.duplicateCents, href: "/shadow-it" },
                { label: "Shelfware on over-commitment", cents: levers.shelfwareCents, href: "/overages" },
              ]
                .sort((a, b) => b.cents - a.cents)
                .map((lever, index) => (
                  <li key={lever.label}>
                    <Link href={lever.href} className="group block">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[13px]" style={{ color: "var(--ink)" }}>
                          {lever.label}
                        </span>
                        <span className="num text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
                          {compactMoney(lever.cents)}
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <Meter ratio={totalLevers ? lever.cents / totalLevers : 0} tone={index === 0 ? "good" : "accent"} />
                      </div>
                    </Link>
                  </li>
                ))}
            </ul>
            <p className="mt-4 text-[11px] leading-relaxed" style={{ color: "var(--ink-3)" }}>
              Estimates use current unit pricing and the last 30 days of activity. Reclamation assumes seats idle
              for 30+ days are removable at the next true-up.
            </p>
          </div>
        </Card>
      </div>

      {/* Attention + renewals ------------------------------------------- */}
      <div className="mb-4 grid items-start gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHead title="Needs a decision" sub="Ranked by how soon the money is committed." />
          <ul>
            {attention.map((item, index) => (
              <li
                key={`${item.title}-${index}`}
                className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5"
                style={{ borderTop: "1px solid var(--line)" }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={item.tone} label={item.tone === "critical" ? "Act now" : "Review"} />
                    <p className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
                      {item.title}
                    </p>
                  </div>
                  <p className="mt-1 text-[12px]" style={{ color: "var(--ink-3)" }}>
                    {item.body}
                  </p>
                </div>
                <Link href={item.href} className="btn btn-sm shrink-0">
                  {item.cta}
                </Link>
              </li>
            ))}
            {attention.length === 0 ? (
              <li className="px-5 py-10 text-center text-[13px]" style={{ color: "var(--ink-3)" }}>
                Nothing needs a decision in the next three weeks.
              </li>
            ) : null}
          </ul>
        </Card>

        <Card>
          <CardHead title="Renewal runway" sub="Committed contract value falling due, next 12 months." />
          <div className="px-2 pb-3">
            <RunwayChart buckets={runway} height={252} />
          </div>
        </Card>
      </div>

      {/* Top vendors ----------------------------------------------------- */}
      <Card>
        <CardHead
          title="Largest vendors this month"
          sub="Sorted by billed spend. Utilisation is active seats over provisioned seats."
          action={
            <Link href="/vendors" className="btn btn-sm">
              All {vendors.length} vendors
            </Link>
          }
        />
        <div className="tbl-scroll thin-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Owner</th>
                <th className="r">This month</th>
                <th className="r">Annualised</th>
                <th className="r">Seats</th>
                <th style={{ width: 150 }}>Utilisation</th>
                <th className="r">Overage</th>
                <th>Renews</th>
              </tr>
            </thead>
            <tbody>
              {topVendors.map((vendor) => {
                const ratio = vendor.provisioned ? vendor.active / vendor.provisioned : 0;
                const days = vendor.termEnd ? daysUntil(vendor.termEnd) : null;
                return (
                  <tr key={vendor.id}>
                    <td>
                      <Link href={`/vendors/${vendor.id}`} className="flex items-center gap-2.5">
                        <VendorMark name={vendor.name} hue={vendor.accentHue} />
                        <span>
                          <span className="block font-semibold" style={{ color: "var(--ink)" }}>
                            {vendor.name}
                          </span>
                          <span className="block text-[11px]" style={{ color: "var(--ink-3)" }}>
                            {vendor.category}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td style={{ color: "var(--ink-2)" }}>
                      {vendor.ownerName ?? "—"}
                      <span className="block text-[11px]" style={{ color: "var(--ink-3)" }}>
                        {vendor.department ?? ""}
                      </span>
                    </td>
                    <td className="r num font-semibold">{money(vendor.monthCents)}</td>
                    <td className="r num" style={{ color: "var(--ink-2)" }}>
                      {compactMoney(vendor.monthCents * 12)}
                    </td>
                    <td className="r num" style={{ color: "var(--ink-2)" }}>
                      {compactNumber(vendor.provisioned)}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="num w-9 shrink-0 text-[12px]" style={{ color: "var(--ink-2)" }}>
                          {percent(ratio)}
                        </span>
                        <span className="flex-1">
                          <Meter ratio={ratio} tone={utilizationTone(ratio)} />
                        </span>
                      </div>
                    </td>
                    <td className="r num">
                      {vendor.overageCents > 0 ? (
                        <span style={{ color: "var(--critical-ink)" }}>{money(vendor.overageCents)}</span>
                      ) : (
                        <span style={{ color: "var(--ink-3)" }}>—</span>
                      )}
                    </td>
                    <td>
                      {days !== null ? (
                        <span className="flex items-center gap-2">
                          <Badge tone={renewalTone(days)}>{relativeDays(days)}</Badge>
                          <span className="hidden text-[11px] xl:inline" style={{ color: "var(--ink-3)" }}>
                            {dateLabel(vendor.termEnd!)}
                          </span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {!scope.deptId ? (
        <Card className="mt-4">
          <CardHead
            title="Departments against budget"
            sub="Annualised spend on vendors owned by each cost centre."
            action={
              <Link href="/budgets" className="btn btn-sm">
                Budget detail
              </Link>
            }
          />
          <div className="grid gap-x-8 gap-y-4 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-3">
            {departments.slice(0, 9).map((department) => {
              const ratio = department.annualBudgetCents
                ? department.annualisedCents / department.annualBudgetCents
                : 0;
              return (
                <div key={department.id}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                      {department.name}
                    </span>
                    <span className="num text-[12px]" style={{ color: ratio > 1 ? "var(--critical-ink)" : "var(--ink-3)" }}>
                      {percent(ratio)} of {compactMoney(department.annualBudgetCents)}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <Meter ratio={Math.min(ratio, 1)} tone={ratio > 1 ? "critical" : ratio > 0.9 ? "warning" : "accent"} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}
    </>
  );
}

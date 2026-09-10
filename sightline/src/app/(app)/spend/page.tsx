import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { can, departmentScope } from "@/lib/rbac";
import { availableMonths, currentMonth, ledger, spendByCategory, spendTrend } from "@/lib/queries";
import { BarList, StackedColumns } from "@/components/charts";
import { seriesColor } from "@/lib/series";
import { Card, CardHead, EmptyState, PageHeader, StatTile, StatusBadge, VendorMark } from "@/components/ui";
import { FilterBar, Field } from "@/components/filter-bar";
import { compactMoney, dateLabel, money, monthLabel, percent, signedPercent } from "@/lib/format";

export const metadata: Metadata = { title: "Spend & invoices" };
export const dynamic = "force-dynamic";

type Search = { month?: string; status?: string };

export default async function SpendPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const params = await searchParams;
  const scope = { orgId: user.orgId, deptId: departmentScope(user) };

  const months = availableMonths(scope);
  const month = params.month && months.includes(params.month) ? params.month : currentMonth();

  const rows = ledger(scope, month).filter((row) => (params.status ? row.status === params.status : true));
  const trend = spendTrend(scope, 12);
  const categories = spendByCategory(scope, month);

  const total = rows.reduce((sum, row) => sum + row.totalCents, 0);
  const base = rows.reduce((sum, row) => sum + row.baseCents, 0);
  const overage = rows.reduce((sum, row) => sum + row.overageCents, 0);
  const credits = rows.reduce((sum, row) => sum + row.creditsCents, 0);
  const unpaid = rows.filter((row) => row.status !== "paid");

  const index = trend.findIndex((point) => point.month === month);
  const previous = index > 0 ? trend[index - 1]!.totalCents : null;

  return (
    <>
      <PageHeader
        eyebrow="Portfolio"
        title="Spend & invoices"
        sub="The invoice ledger behind every figure in Sightline. One row per vendor per billing period, split into committed spend, overage and credits."
        actions={
          can(user, "export.data") ? (
            <a className="btn btn-sm" href="/api/export/vendors" download>
              Export CSV
            </a>
          ) : null
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label={`Billed ${monthLabel(month, "long")}`}
          value={money(total)}
          delta={previous ? (total - previous) / previous : undefined}
          deltaLabel="versus previous month"
          deltaGoodWhen="down"
          hint={`${rows.length} invoices`}
        />
        <StatTile label="Committed spend" value={money(base)} hint={`${percent(total ? base / total : 0)} of the month`} />
        <StatTile
          label="Overage"
          value={money(overage)}
          hint={`${percent(total ? overage / total : 0, 1)} of the month`}
          tone={overage > 0 ? "critical" : undefined}
        />
        <StatTile
          label="Open or disputed"
          value={String(unpaid.length)}
          hint={`${money(unpaid.reduce((sum, row) => sum + row.totalCents, 0))} not yet settled`}
          tone={unpaid.length ? "warning" : undefined}
        />
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHead title="Trailing twelve months" sub="Committed spend and overage by billing period." />
          <div className="px-2 pb-3">
            <StackedColumns
              months={trend.map((point) => point.month)}
              series={[
                { key: "base", label: "Committed spend", color: seriesColor(0) },
                { key: "overage", label: "Overage", color: seriesColor(1) },
              ]}
              data={trend.map((point) => ({ base: point.baseCents, overage: point.overageCents }))}
              format="compactMoney"
              height={272}
              tableLabel="monthly spend"
            />
          </div>
        </Card>
        <Card>
          <CardHead title="Category mix" sub={monthLabel(month, "long")} />
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

      <FilterBar
        action="/spend"
        hint={`${rows.length} invoices · ${money(total)} · credits ${credits ? `−${money(credits)}` : "none"}`}
      >
        <Field label="Billing period" name="month" width={180}>
          <select name="month" defaultValue={month} className="field h-9 text-[13px]">
            {months.map((option) => (
              <option key={option} value={option}>
                {monthLabel(option, "long")}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status" name="status" width={150}>
          <select name="status" defaultValue={params.status ?? ""} className="field h-9 text-[13px]">
            <option value="">Any status</option>
            <option value="paid">Paid</option>
            <option value="open">Open</option>
            <option value="disputed">Disputed</option>
          </select>
        </Field>
      </FilterBar>

      <Card>
        <CardHead title={`Invoices — ${monthLabel(month, "long")}`} sub="Sorted by invoice total." />
        {rows.length === 0 ? (
          <EmptyState title="No invoices for this period" body="Choose another billing period or clear the status filter." />
        ) : (
          <div className="tbl-scroll thin-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Cost centre</th>
                  <th>Issued</th>
                  <th className="r">Committed</th>
                  <th className="r">Overage</th>
                  <th className="r">Credits</th>
                  <th className="r">Total</th>
                  <th className="r">Share</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/vendors/${row.vendorId}`} className="flex items-center gap-2.5">
                        <VendorMark name={row.vendorName} hue={row.accentHue} size={24} />
                        <span>
                          <span className="block font-semibold" style={{ color: "var(--ink)" }}>
                            {row.vendorName}
                          </span>
                          <span className="block text-[11px]" style={{ color: "var(--ink-3)" }}>
                            {row.category}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td style={{ color: "var(--ink-2)" }}>{row.department ?? "—"}</td>
                    <td style={{ color: "var(--ink-3)" }}>{dateLabel(row.issuedAt)}</td>
                    <td className="r num">{money(row.baseCents)}</td>
                    <td className="r num" style={{ color: row.overageCents ? "var(--critical-ink)" : "var(--ink-3)" }}>
                      {row.overageCents ? money(row.overageCents) : "—"}
                    </td>
                    <td className="r num" style={{ color: row.creditsCents ? "var(--good-ink)" : "var(--ink-3)" }}>
                      {row.creditsCents ? `−${money(row.creditsCents)}` : "—"}
                    </td>
                    <td className="r num font-semibold">{money(row.totalCents)}</td>
                    <td className="r num" style={{ color: "var(--ink-3)" }}>
                      {percent(total ? row.totalCents / total : 0, 1)}
                    </td>
                    <td>
                      <StatusBadge
                        tone={row.status === "paid" ? "good" : row.status === "open" ? "warning" : "critical"}
                        label={row.status}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="font-semibold" style={{ color: "var(--ink)" }}>
                    {monthLabel(month, "long")} total
                  </td>
                  <td className="r num font-semibold">{money(base)}</td>
                  <td className="r num font-semibold">{money(overage)}</td>
                  <td className="r num font-semibold">{credits ? `−${money(credits)}` : "—"}</td>
                  <td className="r num font-semibold">{money(total)}</td>
                  <td className="r num" style={{ color: "var(--ink-3)" }}>
                    {previous ? signedPercent((total - previous) / previous) : "—"}
                  </td>
                  <td style={{ color: "var(--ink-3)" }}>{compactMoney(total * 12)}/yr</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

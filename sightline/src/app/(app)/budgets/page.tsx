import Link from "next/link";
import type { Metadata } from "next";
import { currentCsrfToken, requireUser } from "@/lib/auth";
import { can, departmentScope } from "@/lib/rbac";
import { budgets, currentMonth, departmentTrend, headline, vendorRows } from "@/lib/queries";
import { StackedColumns } from "@/components/charts";
import { seriesColor } from "@/lib/series";
import { ActionForm } from "@/components/action-form";
import { saveBudget } from "@/app/(app)/actions";
import { Card, CardHead, Meter, PageHeader, StatTile, StatusBadge, VendorMark } from "@/components/ui";
import { compactMoney, money, monthLabel, percent, signedPercent } from "@/lib/format";

export const metadata: Metadata = { title: "Budgets & chargeback" };
export const dynamic = "force-dynamic";

export default async function BudgetsPage() {
  const user = await requireUser();
  const scope = { orgId: user.orgId, deptId: departmentScope(user) };
  const month = currentMonth();
  const csrf = await currentCsrfToken();

  const rows = budgets(scope, month);
  const head = headline(scope, month);
  const vendors = vendorRows(scope, month);
  const trendRows = departmentTrend(scope, 12);

  const totalBudget = rows.reduce((sum, row) => sum + row.annualBudgetCents, 0);
  const totalAnnualised = rows.reduce((sum, row) => sum + row.annualisedCents, 0);
  const overBudget = rows.filter((row) => row.annualBudgetCents > 0 && row.annualisedCents > row.annualBudgetCents);
  const editable = can(user, "budget.edit");

  // Stacked trend: five largest cost centres, everything else folded into "Other".
  const months = [...new Set(trendRows.map((row) => row.month))].sort();
  const topDepartments = rows.slice(0, 5).map((row) => row.name);
  const series = [
    ...topDepartments.map((name, index) => ({ key: name, label: name, color: seriesColor(index) })),
    { key: "Other", label: "Other cost centres", color: seriesColor(5) },
  ];
  const stacked = months.map((key) => {
    const point: Record<string, number> = { Other: 0 };
    for (const name of topDepartments) point[name] = 0;
    for (const row of trendRows.filter((entry) => entry.month === key)) {
      if (topDepartments.includes(row.department)) point[row.department] = (point[row.department] ?? 0) + row.cents;
      else point.Other = (point.Other ?? 0) + row.cents;
    }
    return point;
  });

  return (
    <>
      <PageHeader
        eyebrow="Govern"
        title="Budgets & chargeback"
        sub="Annualised SaaS spend allocated to the cost centre that owns each contract, measured against the budget on file."
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Annualised spend"
          value={compactMoney(totalAnnualised)}
          hint={`Run-rate from ${monthLabel(month, "long")} invoices`}
        />
        <StatTile
          label="Budget on file"
          value={compactMoney(totalBudget)}
          hint={`${percent(totalBudget ? totalAnnualised / totalBudget : 0)} consumed`}
        />
        <StatTile
          label="Variance"
          value={compactMoney(totalAnnualised - totalBudget)}
          delta={totalBudget ? (totalAnnualised - totalBudget) / totalBudget : 0}
          deltaLabel="against budget"
          deltaGoodWhen="down"
          hint={`${overBudget.length} cost centre${overBudget.length === 1 ? "" : "s"} over budget`}
          tone={overBudget.length ? "critical" : undefined}
        />
        <StatTile
          label="Spend per employee"
          value={money(head.spendPerEmployeeCents)}
          hint={`${head.employees.toLocaleString("en-US")} active employees in scope`}
        />
      </div>

      {months.length > 1 ? (
        <Card className="mb-4">
          <CardHead
            title="Spend by cost centre"
            sub="Monthly invoiced spend, five largest cost centres and everything else."
          />
          <div className="px-2 pb-3">
            <StackedColumns
              months={months}
              series={series}
              data={stacked}
              format="compactMoney"
              height={280}
              tableLabel="cost centre spend"
            />
          </div>
        </Card>
      ) : null}

      <Card className="mb-4">
        <CardHead
          title="Cost centres"
          sub={editable ? "Budgets are editable by Finance and administrators; every change is audited." : "Budgets are set by Finance."}
        />
        <div className="tbl-scroll thin-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Cost centre</th>
                <th>Owner</th>
                <th className="r">Headcount</th>
                <th className="r">Vendors</th>
                <th className="r">Annualised</th>
                <th className="r">Budget</th>
                <th style={{ width: 170 }}>Consumed</th>
                <th className="r">Variance</th>
                <th className="r">Per head</th>
                {editable ? <th style={{ width: 196 }}>Set budget</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const ratio = row.annualBudgetCents ? row.annualisedCents / row.annualBudgetCents : 0;
                const variance = row.annualisedCents - row.annualBudgetCents;
                return (
                  <tr key={row.id}>
                    <td>
                      <span className="block font-semibold" style={{ color: "var(--ink)" }}>
                        {row.name}
                      </span>
                      <span className="block text-[11px]" style={{ color: "var(--ink-3)" }}>
                        {row.costCenter}
                      </span>
                    </td>
                    <td className="whitespace-nowrap" style={{ color: "var(--ink-2)" }}>{row.ownerName ?? "—"}</td>
                    <td className="r num" style={{ color: "var(--ink-2)" }}>
                      {row.headcount}
                    </td>
                    <td className="r num" style={{ color: "var(--ink-2)" }}>
                      {row.vendors}
                    </td>
                    <td className="r num font-semibold">{money(row.annualisedCents)}</td>
                    <td className="r num" style={{ color: "var(--ink-2)" }}>
                      {row.annualBudgetCents ? money(row.annualBudgetCents) : "—"}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="num w-11 shrink-0 text-[12px]" style={{ color: ratio > 1 ? "var(--critical-ink)" : "var(--ink-2)" }}>
                          {row.annualBudgetCents ? percent(ratio) : "—"}
                        </span>
                        <span className="flex-1">
                          <Meter ratio={Math.min(ratio, 1)} tone={ratio > 1 ? "critical" : ratio > 0.9 ? "warning" : "accent"} />
                        </span>
                      </div>
                    </td>
                    <td className="r num" style={{ color: variance > 0 ? "var(--critical-ink)" : "var(--good-ink)" }}>
                      {`${variance > 0 ? "+" : "−"}${money(Math.abs(variance))}`}
                      <span className="block text-[11px]" style={{ color: "var(--ink-3)" }}>
                        {row.annualBudgetCents ? signedPercent(variance / row.annualBudgetCents, 0) : ""}
                      </span>
                    </td>
                    <td className="r num" style={{ color: "var(--ink-2)" }}>
                      {row.headcount ? money(Math.round(row.annualisedCents / row.headcount)) : "—"}
                    </td>
                    {editable ? (
                      <td>
                        <ActionForm
                          action={saveBudget}
                          submitLabel="Save"
                          submitClass="btn btn-sm"
                          className="flex items-end gap-2 [&>div]:mt-0"
                        >
                          <input type="hidden" name="csrf" value={csrf} />
                          <input type="hidden" name="departmentId" value={row.id} />
                          <label className="sr-only" htmlFor={`budget-${row.id}`}>
                            {row.name} annual budget in dollars
                          </label>
                          <input
                            id={`budget-${row.id}`}
                            name="annualBudget"
                            type="number"
                            min={0}
                            step={1000}
                            defaultValue={Math.round(row.annualBudgetCents / 100)}
                            className="field num h-8 w-[104px] text-[12px]"
                          />
                        </ActionForm>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHead
          title="Chargeback detail"
          sub={`Vendors allocated to each cost centre, ${monthLabel(month, "long")}.`}
        />
        <div className="grid gap-x-8 gap-y-6 px-5 pb-6 lg:grid-cols-2 xl:grid-cols-3">
          {rows.map((department) => {
            const owned = vendors.filter((vendor) => vendor.department === department.name).slice(0, 6);
            if (owned.length === 0) return null;
            return (
              <div key={department.id}>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <p className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
                    {department.name}
                  </p>
                  <p className="num text-[12px]" style={{ color: "var(--ink-3)" }}>
                    {money(department.monthCents)} / mo
                  </p>
                </div>
                <ul className="space-y-1.5">
                  {owned.map((vendor) => (
                    <li key={vendor.id}>
                      <Link href={`/vendors/${vendor.id}`} className="flex items-center justify-between gap-3 text-[12px]">
                        <span className="flex min-w-0 items-center gap-2">
                          <VendorMark name={vendor.name} hue={vendor.accentHue} size={18} />
                          <span className="truncate" style={{ color: "var(--ink-2)" }}>
                            {vendor.name}
                          </span>
                        </span>
                        <span className="num shrink-0" style={{ color: "var(--ink)" }}>
                          {money(vendor.monthCents)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Card>

      {overBudget.length ? (
        <Card className="mt-4">
          <CardHead title="Over budget" sub="Cost centres whose annualised run-rate exceeds the budget on file." />
          <ul className="px-5 pb-5">
            {overBudget.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 border-b py-2.5 last:border-0" style={{ borderColor: "var(--line)" }}>
                <span className="flex items-center gap-2.5">
                  <StatusBadge tone="critical" label="Over" />
                  <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                    {row.name}
                  </span>
                </span>
                <span className="num text-[13px]" style={{ color: "var(--critical-ink)" }}>
                  {money(row.annualisedCents - row.annualBudgetCents)} over {money(row.annualBudgetCents)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}

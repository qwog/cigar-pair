import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { can, departmentScope } from "@/lib/rbac";
import { currentMonth, vendorRows } from "@/lib/queries";
import { Badge, Card, CardHead, EmptyState, Meter, PageHeader, StatusBadge, VendorMark, renewalTone, riskTone, utilizationTone } from "@/components/ui";
import { FilterBar, Field } from "@/components/filter-bar";
import { compactMoney, dateLabel, daysUntil, money, monthLabel, percent, relativeDays } from "@/lib/format";

export const metadata: Metadata = { title: "Vendors" };
export const dynamic = "force-dynamic";

type Search = { q?: string; category?: string; risk?: string; sort?: string; renewal?: string };

const SORTS: Record<string, (a: ReturnType<typeof vendorRows>[number], b: ReturnType<typeof vendorRows>[number]) => number> = {
  spend: (a, b) => b.monthCents - a.monthCents,
  name: (a, b) => a.name.localeCompare(b.name),
  utilisation: (a, b) => (a.provisioned ? a.active / a.provisioned : 1) - (b.provisioned ? b.active / b.provisioned : 1),
  renewal: (a, b) => (a.termEnd ?? "9999").localeCompare(b.termEnd ?? "9999"),
  waste: (a, b) => b.dormantCostCents - a.dormantCostCents,
};

export default async function VendorsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const params = await searchParams;
  const scope = { orgId: user.orgId, deptId: departmentScope(user) };
  const month = currentMonth();

  const all = vendorRows(scope, month);
  const categories = [...new Set(all.map((vendor) => vendor.category))].sort();

  const query = (params.q ?? "").trim().toLowerCase();
  const filtered = all
    .filter((vendor) => (query ? `${vendor.name} ${vendor.category} ${vendor.ownerName ?? ""}`.toLowerCase().includes(query) : true))
    .filter((vendor) => (params.category ? vendor.category === params.category : true))
    .filter((vendor) => (params.risk ? vendor.riskTier === params.risk : true))
    .filter((vendor) => {
      if (!params.renewal) return true;
      const days = vendor.termEnd ? daysUntil(vendor.termEnd) : Infinity;
      return days <= Number(params.renewal);
    })
    .sort(SORTS[params.sort ?? "spend"] ?? SORTS.spend!);

  const totalMonth = filtered.reduce((sum, vendor) => sum + vendor.monthCents, 0);
  const totalWaste = filtered.reduce((sum, vendor) => sum + vendor.dormantCostCents, 0);

  return (
    <>
      <PageHeader
        eyebrow="Portfolio"
        title="Vendors"
        sub="Every contracted application, its owner, what it costs this month and how much of it is actually being used."
        actions={
          can(user, "export.data") ? (
            <a className="btn btn-sm" href="/api/export/vendors" download>
              Export CSV
            </a>
          ) : null
        }
      />

      <FilterBar
        action="/vendors"
        hint={`${filtered.length} of ${all.length} vendors · ${money(totalMonth)} in ${monthLabel(month, "long")} · ${compactMoney(totalWaste * 12)} dormant`}
      >
        <Field label="Search" name="q" width={210}>
          <input name="q" defaultValue={params.q ?? ""} placeholder="Vendor, category, owner" className="field h-9 text-[13px]" />
        </Field>
        <Field label="Category" name="category">
          <select name="category" defaultValue={params.category ?? ""} className="field h-9 text-[13px]">
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Risk tier" name="risk" width={140}>
          <select name="risk" defaultValue={params.risk ?? ""} className="field h-9 text-[13px]">
            <option value="">Any risk</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </Field>
        <Field label="Renews within" name="renewal" width={150}>
          <select name="renewal" defaultValue={params.renewal ?? ""} className="field h-9 text-[13px]">
            <option value="">Any date</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="180">180 days</option>
          </select>
        </Field>
        <Field label="Sort by" name="sort" width={160}>
          <select name="sort" defaultValue={params.sort ?? "spend"} className="field h-9 text-[13px]">
            <option value="spend">Spend, high to low</option>
            <option value="waste">Dormant spend</option>
            <option value="utilisation">Utilisation, low first</option>
            <option value="renewal">Renewal date</option>
            <option value="name">Name</option>
          </select>
        </Field>
      </FilterBar>

      <Card>
        <CardHead
          title={`${filtered.length} vendor${filtered.length === 1 ? "" : "s"}`}
          sub={`Billed figures are for ${monthLabel(month, "long")}. Utilisation counts seats active in the last 30 days.`}
        />
        {filtered.length === 0 ? (
          <EmptyState title="No vendors match those filters" body="Clear the filters or widen the renewal window." />
        ) : (
          <div className="tbl-scroll thin-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Owner</th>
                  <th>Governance</th>
                  <th className="r">Seats</th>
                  <th style={{ width: 140 }}>Utilisation</th>
                  <th className="r">Dormant</th>
                  <th className="r">This month</th>
                  <th className="r">Overage</th>
                  <th>Renews</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((vendor) => {
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
                              {vendor.category} · {vendor.planName ?? "No plan on file"}
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
                      <td>
                        <span className="flex flex-wrap items-center gap-1">
                          <StatusBadge tone={riskTone(vendor.riskTier)} label={`${vendor.riskTier} risk`} />
                          {vendor.ssoEnforced ? null : <Badge tone="warning">No SSO</Badge>}
                        </span>
                      </td>
                      <td className="r num" style={{ color: "var(--ink-2)" }}>
                        {vendor.provisioned.toLocaleString("en-US")}
                        <span className="block text-[11px]" style={{ color: "var(--ink-3)" }}>
                          {vendor.committedSeats ? `${vendor.committedSeats.toLocaleString("en-US")} committed` : "no seat commit"}
                        </span>
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
                        {vendor.dormant > 0 ? (
                          <>
                            <span style={{ color: "var(--ink)" }}>{vendor.dormant}</span>
                            <span className="block text-[11px]" style={{ color: "var(--ink-3)" }}>
                              {compactMoney(vendor.dormantCostCents * 12)}/yr
                            </span>
                          </>
                        ) : (
                          <span style={{ color: "var(--ink-3)" }}>—</span>
                        )}
                      </td>
                      <td className="r num font-semibold">{money(vendor.monthCents)}</td>
                      <td className="r num">
                        {vendor.overageCents > 0 ? (
                          <span style={{ color: "var(--critical-ink)" }}>{money(vendor.overageCents)}</span>
                        ) : (
                          <span style={{ color: "var(--ink-3)" }}>—</span>
                        )}
                      </td>
                      <td>
                        {days !== null ? (
                          <>
                            <Badge tone={renewalTone(days)}>{relativeDays(days)}</Badge>
                            <span className="mt-0.5 block text-[11px]" style={{ color: "var(--ink-3)" }}>
                              {dateLabel(vendor.termEnd!)}
                              {vendor.autoRenew ? " · auto" : ""}
                            </span>
                          </>
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
        )}
      </Card>
    </>
  );
}

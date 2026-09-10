import Link from "next/link";
import type { Metadata } from "next";
import { currentCsrfToken, requireUser } from "@/lib/auth";
import { can, departmentScope } from "@/lib/rbac";
import { shadowIt, vendorRows } from "@/lib/queries";
import { BarList } from "@/components/charts";
import { ActionForm } from "@/components/action-form";
import { setFindingStatus } from "@/app/(app)/actions";
import { Badge, Card, CardHead, EmptyState, Meter, PageHeader, StatTile, StatusBadge } from "@/components/ui";
import { compactMoney, dateLabel, money, percent } from "@/lib/format";

export const metadata: Metadata = { title: "Shadow IT" };
export const dynamic = "force-dynamic";

const STATUSES = [
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "approved", label: "Approved" },
  { value: "blocked", label: "Blocked" },
  { value: "consolidated", label: "Consolidated" },
];

const SOURCE_LABEL: Record<string, string> = {
  expense: "Expense report",
  sso: "Identity provider",
  network: "Network egress",
  oauth_grant: "OAuth grant",
};

const statusTone = (status: string) =>
  status === "blocked"
    ? ("critical" as const)
    : status === "approved"
      ? ("good" as const)
      : status === "consolidated"
        ? ("accent" as const)
        : status === "reviewing"
          ? ("warning" as const)
          : ("serious" as const);

const riskTone = (score: number) =>
  score >= 70 ? ("critical" as const) : score >= 45 ? ("serious" as const) : ("warning" as const);

export default async function ShadowItPage() {
  const user = await requireUser();
  const scope = { orgId: user.orgId, deptId: departmentScope(user) };
  const csrf = await currentCsrfToken();

  const findings = shadowIt(scope);
  const vendors = vendorRows(scope);
  const editable = can(user, "shadow_it.triage");

  const annualSpend = findings.reduce((sum, finding) => sum + finding.monthlySpendCents * 12, 0);
  const highRisk = findings.filter((finding) => finding.riskScore >= 70);
  const untriaged = findings.filter((finding) => finding.status === "new");
  const overlapping = findings.filter((finding) => finding.overlapsVendor);
  const overlapAnnual = overlapping.reduce((sum, finding) => sum + finding.monthlySpendCents * 12, 0);
  const usersExposed = findings.reduce((sum, finding) => sum + finding.userCount, 0);

  const byCategory = Object.entries(
    findings.reduce<Record<string, number>>((acc, finding) => {
      acc[finding.category] = (acc[finding.category] ?? 0) + finding.monthlySpendCents * 12;
      return acc;
    }, {}),
  )
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <>
      <PageHeader
        eyebrow="Govern"
        title="Shadow IT"
        sub="Applications reaching company data without going through procurement — reconstructed from expense reports, the identity provider, OAuth grants and network egress."
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Unsanctioned applications"
          value={String(findings.length)}
          hint={`${untriaged.length} still untriaged`}
          tone={untriaged.length ? "critical" : undefined}
        />
        <StatTile
          label="Annualised spend"
          value={compactMoney(annualSpend)}
          hint="Off-contract, mostly on expense reports"
        />
        <StatTile
          label="High-risk grants"
          value={String(highRisk.length)}
          hint="Risk 70+ — broad data scopes or no SSO enforcement"
          tone={highRisk.length ? "critical" : undefined}
        />
        <StatTile
          label="Duplicating a contracted tool"
          value={compactMoney(overlapAnnual)}
          hint={`${overlapping.length} apps overlap something you already pay for`}
        />
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHead
            title="Exposure"
            sub={`${usersExposed.toLocaleString("en-US")} employee accounts across unsanctioned applications.`}
          />
          <div className="grid gap-5 px-5 pb-5 sm:grid-cols-2">
            <div>
              <p className="eyebrow mb-2">By discovery source</p>
              <ul className="space-y-2">
                {Object.entries(
                  findings.reduce<Record<string, number>>((acc, finding) => {
                    acc[finding.source] = (acc[finding.source] ?? 0) + 1;
                    return acc;
                  }, {}),
                ).map(([source, count]) => (
                  <li key={source} className="flex items-center justify-between gap-3 text-[13px]">
                    <span style={{ color: "var(--ink-2)" }}>{SOURCE_LABEL[source] ?? source}</span>
                    <span className="num font-semibold" style={{ color: "var(--ink)" }}>
                      {count}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="eyebrow mb-2">Annualised spend by category</p>
              <BarList items={byCategory.slice(0, 6)} tableLabel="shadow IT spend" valueLabel="Annualised" />
            </div>
          </div>
        </Card>

        <Card>
          <CardHead title="Consolidation candidates" sub="Unsanctioned apps that duplicate a tool already under contract." />
          <ul className="px-5 pb-5">
            {overlapping.map((finding) => {
              const vendor = vendors.find((entry) => entry.name === finding.overlapsVendor);
              return (
                <li key={finding.id} className="border-b py-2.5 last:border-0" style={{ borderColor: "var(--line)" }}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                      {finding.appName}
                    </span>
                    <span className="num text-[12px]" style={{ color: "var(--ink)" }}>
                      {money(finding.monthlySpendCents * 12)}/yr
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px]" style={{ color: "var(--ink-3)" }}>
                    Overlaps{" "}
                    {vendor ? (
                      <Link href={`/vendors/${vendor.id}`} className="underline">
                        {finding.overlapsVendor}
                      </Link>
                    ) : (
                      finding.overlapsVendor
                    )}{" "}
                    · {finding.userCount} users
                  </p>
                </li>
              );
            })}
            {overlapping.length === 0 ? (
              <li className="py-6 text-center text-[13px]" style={{ color: "var(--ink-3)" }}>
                No overlaps detected.
              </li>
            ) : null}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHead
          title="Findings"
          sub={
            editable
              ? "Ranked by risk score. Triage decisions are written to the audit log."
              : "Ranked by risk score. Triage requires an administrator or IT operations role."
          }
        />
        {findings.length === 0 ? (
          <EmptyState title="Nothing unsanctioned detected" body="Every application reaching company data is under contract." />
        ) : (
          <div className="tbl-scroll thin-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Application</th>
                  <th>Discovered via</th>
                  <th>Department</th>
                  <th className="r">Users</th>
                  <th className="r">Annualised</th>
                  <th style={{ width: 150 }}>Risk</th>
                  <th>Data access</th>
                  <th>Status</th>
                  {editable ? <th style={{ width: 200 }}>Triage</th> : null}
                </tr>
              </thead>
              <tbody>
                {findings.map((finding) => (
                  <tr key={finding.id}>
                    <td>
                      <span className="block font-semibold" style={{ color: "var(--ink)" }}>
                        {finding.appName}
                      </span>
                      <span className="block text-[11px]" style={{ color: "var(--ink-3)" }}>
                        {finding.category} · first seen {dateLabel(finding.firstSeenAt)}
                      </span>
                    </td>
                    <td style={{ color: "var(--ink-2)" }}>{SOURCE_LABEL[finding.source] ?? finding.source}</td>
                    <td style={{ color: "var(--ink-2)" }}>{finding.department ?? "—"}</td>
                    <td className="r num" style={{ color: "var(--ink-2)" }}>
                      {finding.userCount}
                    </td>
                    <td className="r num font-semibold">{money(finding.monthlySpendCents * 12)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="num w-8 shrink-0 text-[12px]" style={{ color: "var(--ink-2)" }}>
                          {finding.riskScore}
                        </span>
                        <span className="flex-1">
                          <Meter ratio={finding.riskScore / 100} tone={riskTone(finding.riskScore)} />
                        </span>
                      </div>
                      <span className="mt-1 block text-[11px]" style={{ color: "var(--ink-3)" }}>
                        {percent(finding.riskScore / 100)} of maximum
                      </span>
                    </td>
                    <td className="max-w-[220px] text-[12px]" style={{ color: "var(--ink-2)" }}>
                      {finding.dataScopes ?? "—"}
                      {finding.overlapsVendor ? (
                        <Badge tone="accent">Overlaps {finding.overlapsVendor}</Badge>
                      ) : null}
                    </td>
                    <td>
                      <StatusBadge tone={statusTone(finding.status)} label={finding.status} />
                    </td>
                    {editable ? (
                      <td>
                        <ActionForm
                          action={setFindingStatus}
                          submitLabel="Update"
                          submitClass="btn btn-sm"
                          className="flex flex-wrap items-end gap-2 [&>div]:mt-0"
                        >
                          <input type="hidden" name="csrf" value={csrf} />
                          <input type="hidden" name="findingId" value={finding.id} />
                          <label className="sr-only" htmlFor={`status-${finding.id}`}>
                            {finding.appName} status
                          </label>
                          <select
                            id={`status-${finding.id}`}
                            name="status"
                            defaultValue={finding.status}
                            className="field h-8 w-[124px] text-[12px]"
                          >
                            {STATUSES.map((status) => (
                              <option key={status.value} value={status.value}>
                                {status.label}
                              </option>
                            ))}
                          </select>
                        </ActionForm>
                      </td>
                    ) : null}
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

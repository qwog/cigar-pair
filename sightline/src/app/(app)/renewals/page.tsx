import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { can, departmentScope } from "@/lib/rbac";
import { currentMonth, orgUsers, renewals } from "@/lib/queries";
import { RunwayChart } from "@/components/charts";
import { ActionForm } from "@/components/action-form";
import { CsrfField } from "@/components/csrf";
import { saveRenewal } from "@/app/(app)/actions";
import { Badge, Card, CardHead, EmptyState, PageHeader, StatTile, StatusBadge, VendorMark, renewalTone } from "@/components/ui";
import { FilterBar, Field } from "@/components/filter-bar";
import { compactMoney, dateLabel, money, percent, relativeDays } from "@/lib/format";

export const metadata: Metadata = { title: "Renewals" };
export const dynamic = "force-dynamic";

const STAGES = [
  { value: "not_started", label: "Not started", tone: "neutral" as const },
  { value: "scoping", label: "Scoping", tone: "accent" as const },
  { value: "negotiating", label: "Negotiating", tone: "warning" as const },
  { value: "legal", label: "Legal review", tone: "serious" as const },
  { value: "cancelling", label: "Cancelling", tone: "critical" as const },
  { value: "signed", label: "Signed", tone: "good" as const },
];

const stageMeta = (stage: string | null) => STAGES.find((entry) => entry.value === stage) ?? STAGES[0]!;

type Search = { window?: string; stage?: string };

export default async function RenewalsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const params = await searchParams;
  const scope = { orgId: user.orgId, deptId: departmentScope(user) };
  const month = currentMonth();

  const windowDays = Number(params.window ?? 180) || 180;
  const all = renewals(scope, 400, month);
  const rows = all
    .filter((row) => row.daysToRenewal <= windowDays)
    .filter((row) => (params.stage ? (row.stage ?? "not_started") === params.stage : true));

  const owners = orgUsers(user.orgId);
  const editable = can(user, "renewal.manage");

  const in30 = all.filter((row) => row.daysToRenewal <= 30);
  const in90 = all.filter((row) => row.daysToRenewal <= 90);
  const autoInNotice = all.filter((row) => row.autoRenew && row.daysToNotice <= 14);
  const targetSavings = all.reduce((sum, row) => sum + (row.targetSavingsCents ?? 0), 0);
  const upliftExposure = all
    .filter((row) => row.daysToRenewal <= 180)
    .reduce((sum, row) => sum + row.annualCommitCents * row.uplift, 0);

  const runway = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + index, 1));
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const inMonth = all.filter((row) => row.termEnd.slice(0, 7) === key);
    return { month: key, cents: inMonth.reduce((sum, row) => sum + row.annualCommitCents, 0), count: inMonth.length };
  });

  return (
    <>
      <PageHeader
        eyebrow="Optimise"
        title="Renewals"
        sub="Every contract with a date attached, who owns the negotiation, and how long is left before the notice window closes and the term rolls automatically."
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Renewing in 30 days"
          value={String(in30.length)}
          hint={`${money(in30.reduce((sum, row) => sum + row.annualCommitCents, 0))} of committed value`}
          tone={in30.length > 0 ? "critical" : undefined}
        />
        <StatTile
          label="Renewing in 90 days"
          value={String(in90.length)}
          hint={`${money(in90.reduce((sum, row) => sum + row.annualCommitCents, 0))} of committed value`}
        />
        <StatTile
          label="Auto-renew inside notice"
          value={String(autoInNotice.length)}
          hint="Contracts that roll automatically unless notice is served this fortnight"
          tone={autoInNotice.length > 0 ? "critical" : undefined}
        />
        <StatTile
          label="Savings targeted"
          value={compactMoney(targetSavings)}
          hint={`Against ${compactMoney(upliftExposure)} of uplift vendors are asking for`}
        />
      </div>

      <Card className="mb-4">
        <CardHead title="Renewal runway" sub="Committed contract value falling due each month for the next year." />
        <div className="px-2 pb-3">
          <RunwayChart buckets={runway} height={232} />
        </div>
      </Card>

      <FilterBar action="/renewals" hint={`${rows.length} contracts in view`}>
        <Field label="Window" name="window" width={160}>
          <select name="window" defaultValue={String(windowDays)} className="field h-9 text-[13px]">
            <option value="30">Next 30 days</option>
            <option value="90">Next 90 days</option>
            <option value="180">Next 180 days</option>
            <option value="400">Next 12 months</option>
          </select>
        </Field>
        <Field label="Stage" name="stage" width={180}>
          <select name="stage" defaultValue={params.stage ?? ""} className="field h-9 text-[13px]">
            <option value="">Any stage</option>
            {STAGES.map((stage) => (
              <option key={stage.value} value={stage.value}>
                {stage.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="ml-auto flex flex-wrap items-end gap-1.5 pb-1">
          {STAGES.map((stage) => {
            const count = all.filter((row) => (row.stage ?? "not_started") === stage.value).length;
            return count ? (
              <Link key={stage.value} href={`/renewals?window=${windowDays}&stage=${stage.value}`}>
                <Badge tone={stage.tone}>
                  {stage.label} {count}
                </Badge>
              </Link>
            ) : null;
          })}
        </div>
      </FilterBar>

      <Card>
        <CardHead
          title="Renewal pipeline"
          sub="Ordered by term end. Expand a row to reassign the owner, move the stage or leave negotiation notes."
        />
        {rows.length === 0 ? (
          <EmptyState title="No renewals in this window" body="Widen the window or clear the stage filter." />
        ) : (
          <ul>
            {rows.map((row) => {
              const stage = stageMeta(row.stage);
              const utilisation = row.provisioned ? row.active / row.provisioned : 0;
              const noticeClosed = row.daysToNotice <= 0;
              return (
                <li key={row.contractId} id={row.contractId} style={{ borderTop: "1px solid var(--line)" }}>
                  <details className="group">
                    <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5 hover:bg-[var(--surface-2)]">
                      <span className="flex min-w-[190px] flex-1 items-center gap-2.5">
                        <VendorMark name={row.vendorName} hue={row.accentHue} size={26} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold" style={{ color: "var(--ink)" }}>
                            {row.vendorName}
                          </span>
                          <span className="block truncate text-[11px]" style={{ color: "var(--ink-3)" }}>
                            {row.planName} · {row.department ?? row.category}
                          </span>
                        </span>
                      </span>

                      <span className="w-[128px]">
                        <Badge tone={renewalTone(row.daysToRenewal)}>{relativeDays(row.daysToRenewal)}</Badge>
                        <span className="mt-0.5 block text-[11px]" style={{ color: "var(--ink-3)" }}>
                          {dateLabel(row.termEnd)}
                        </span>
                      </span>

                      <span className="w-[152px]">
                        {row.autoRenew ? (
                          <StatusBadge
                            tone={noticeClosed ? "critical" : row.daysToNotice <= 21 ? "serious" : "warning"}
                            label={noticeClosed ? "Notice window closed" : `Notice ${relativeDays(row.daysToNotice)}`}
                          />
                        ) : (
                          <Badge tone="neutral">Manual renewal</Badge>
                        )}
                      </span>

                      <span className="num w-[104px] text-right">
                        <span className="block font-semibold" style={{ color: "var(--ink)" }}>
                          {money(row.annualCommitCents)}
                        </span>
                        <span className="block text-[11px]" style={{ color: "var(--ink-3)" }}>
                          +{Math.round(row.uplift * 100)}% asked
                        </span>
                      </span>

                      <span className="num w-[76px] text-right text-[12px]" style={{ color: "var(--ink-2)" }}>
                        {percent(utilisation)} used
                      </span>

                      <span className="w-[112px]">
                        <Badge tone={stage.tone}>{stage.label}</Badge>
                      </span>

                      <span className="w-[104px] truncate text-[12px]" style={{ color: "var(--ink-3)" }}>
                        {row.ownerName ?? "Unassigned"}
                      </span>

                      <span aria-hidden className="text-[11px] group-open:rotate-180" style={{ color: "var(--ink-3)" }}>
                        ▾
                      </span>
                    </summary>

                    <div className="grid gap-6 px-5 pb-5 pt-1 lg:grid-cols-[1fr_320px]">
                      <div>
                        <p className="eyebrow mb-2">Negotiation position</p>
                        <ul className="space-y-1.5 text-[13px]" style={{ color: "var(--ink-2)" }}>
                          <li>
                            Committed <strong style={{ color: "var(--ink)" }}>{row.committedSeats.toLocaleString("en-US")}</strong> seats;
                            provisioned <strong style={{ color: "var(--ink)" }}>{row.provisioned.toLocaleString("en-US")}</strong>,
                            of which <strong style={{ color: "var(--ink)" }}>{row.active.toLocaleString("en-US")}</strong> were active in
                            the last 30 days.
                          </li>
                          <li>
                            Vendor is asking <strong style={{ color: "var(--ink)" }}>+{Math.round(row.uplift * 100)}%</strong>, worth{" "}
                            <strong style={{ color: "var(--ink)" }}>{money(Math.round(row.annualCommitCents * row.uplift))}</strong> a year.
                          </li>
                          <li>
                            Target saving on file:{" "}
                            <strong style={{ color: "var(--ink)" }}>{money(row.targetSavingsCents ?? 0)}</strong>
                            {row.dueAt ? ` · internal decision due ${dateLabel(row.dueAt)}` : ""}
                          </li>
                          {utilisation < 0.7 ? (
                            <li style={{ color: "var(--critical-ink)" }}>
                              Utilisation is {percent(utilisation)} — the seat count is the strongest lever in this negotiation.
                            </li>
                          ) : null}
                        </ul>
                        {row.notes ? (
                          <p className="mt-3 rounded-lg px-3 py-2 text-[12px]" style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}>
                            {row.notes}
                          </p>
                        ) : null}
                        <p className="mt-3">
                          <Link href={`/vendors/${row.vendorId}`} className="btn btn-sm">
                            Open vendor
                          </Link>
                        </p>
                      </div>

                      <div>
                        <p className="eyebrow mb-2">Update</p>
                        {editable ? (
                          <ActionForm action={saveRenewal} submitLabel="Save renewal">
                            <CsrfField />
                            <input type="hidden" name="contractId" value={row.contractId} />
                            <label className="label">Stage</label>
                            <select name="stage" defaultValue={row.stage ?? "not_started"} className="field h-9 text-[13px]">
                              {STAGES.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <label className="label mt-3">Owner</label>
                            <select name="ownerUserId" defaultValue={row.ownerUserId ?? ""} className="field h-9 text-[13px]">
                              <option value="">Unassigned</option>
                              {owners.map((owner) => (
                                <option key={owner.id} value={owner.id}>
                                  {owner.name}
                                </option>
                              ))}
                            </select>
                            <label className="label mt-3">Notes</label>
                            <textarea
                              name="notes"
                              rows={3}
                              defaultValue={row.notes ?? ""}
                              placeholder="Counter-offer, benchmark, consolidation plan…"
                              className="field h-auto py-2 text-[13px]"
                            />
                          </ActionForm>
                        ) : (
                          <p className="text-[12px]" style={{ color: "var(--ink-3)" }}>
                            Your role can view the pipeline but not change it. Department owners, Finance, IT and
                            administrators can update renewals.
                          </p>
                        )}
                      </div>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}

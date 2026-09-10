import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { monthRange } from "@/lib/format";

/**
 * Every read the dashboard performs. Two rules hold throughout:
 *   1. `orgId` is always bound — nothing crosses a tenant boundary.
 *   2. `deptId` (non-null only for department owners) narrows the vendor set,
 *      so a scoped user's totals are the totals of what they can actually see.
 */

export type Scope = { orgId: string; deptId: string | null };

const scoped = (scope: Scope): SQL =>
  scope.deptId
    ? sql`v.org_id = ${scope.orgId} AND v.department_id = ${scope.deptId}`
    : sql`v.org_id = ${scope.orgId}`;

export function currentMonth(): string {
  const row = db.get<{ m: string }>(sql`SELECT MAX(period_month) AS m FROM invoices`);
  return row?.m ?? monthRange(1)[0]!;
}

// ------------------------------------------------------------------ headline

export type Headline = {
  month: string;
  monthlySpendCents: number;
  annualRunRateCents: number;
  momDelta: number;
  yoyDelta: number;
  vendorCount: number;
  seatsProvisioned: number;
  seatsActive: number;
  overageMonthCents: number;
  overageTrailingCents: number;
  dormantSeats: number;
  dormantAnnualCents: number;
  renewals90: number;
  renewals90ValueCents: number;
  budgetCents: number;
  spendPerEmployeeCents: number;
  employees: number;
};

export function headline(scope: Scope, month = currentMonth()): Headline {
  const prevMonth = monthRange(2, new Date(`${month}-15T00:00:00Z`))[0]!;
  const yearAgo = monthRange(13, new Date(`${month}-15T00:00:00Z`))[0]!;

  const spend = db.get<{ total: number; overage: number; vendors: number }>(sql`
    SELECT COALESCE(SUM(i.total_cents), 0) AS total,
           COALESCE(SUM(i.overage_cents), 0) AS overage,
           COUNT(DISTINCT i.vendor_id) AS vendors
    FROM invoices i JOIN vendors v ON v.id = i.vendor_id
    WHERE ${scoped(scope)} AND i.period_month = ${month}`);

  const prior = db.get<{ total: number }>(sql`
    SELECT COALESCE(SUM(i.total_cents), 0) AS total
    FROM invoices i JOIN vendors v ON v.id = i.vendor_id
    WHERE ${scoped(scope)} AND i.period_month = ${prevMonth}`);

  const prior12 = db.get<{ total: number }>(sql`
    SELECT COALESCE(SUM(i.total_cents), 0) AS total
    FROM invoices i JOIN vendors v ON v.id = i.vendor_id
    WHERE ${scoped(scope)} AND i.period_month = ${yearAgo}`);

  const trailingOverage = db.get<{ total: number }>(sql`
    SELECT COALESCE(SUM(i.overage_cents), 0) AS total
    FROM invoices i JOIN vendors v ON v.id = i.vendor_id
    WHERE ${scoped(scope)} AND i.period_month >= ${monthRange(12, new Date(`${month}-15T00:00:00Z`))[0]!}`);

  const seats = db.get<{ provisioned: number; active: number }>(sql`
    SELECT COALESCE(SUM(u.provisioned_seats), 0) AS provisioned,
           COALESCE(SUM(u.active_seats), 0) AS active
    FROM usage_snapshots u JOIN vendors v ON v.id = u.vendor_id
    WHERE ${scoped(scope)} AND u.period_month = ${month}`);

  const dormant = db.get<{ n: number; cents: number }>(sql`
    SELECT COUNT(*) AS n, COALESCE(SUM(s.monthly_cost_cents), 0) AS cents
    FROM seat_assignments s JOIN vendors v ON v.id = s.vendor_id
    WHERE ${scoped(scope)} AND s.status = 'flagged'`);

  const renewals = db.get<{ n: number; cents: number }>(sql`
    SELECT COUNT(*) AS n, COALESCE(SUM(c.annual_commit_cents), 0) AS cents
    FROM contracts c JOIN vendors v ON v.id = c.vendor_id
    WHERE ${scoped(scope)} AND c.status = 'active'
      AND julianday(c.term_end) - julianday('now') BETWEEN 0 AND 90`);

  const budget = db.get<{ cents: number }>(
    scope.deptId
      ? sql`SELECT COALESCE(SUM(annual_budget_cents), 0) AS cents FROM departments WHERE id = ${scope.deptId}`
      : sql`SELECT COALESCE(SUM(annual_budget_cents), 0) AS cents FROM departments WHERE org_id = ${scope.orgId}`,
  );

  const staff = db.get<{ n: number }>(
    scope.deptId
      ? sql`SELECT COUNT(*) AS n FROM employees WHERE department_id = ${scope.deptId} AND status = 'active'`
      : sql`SELECT COUNT(*) AS n FROM employees WHERE org_id = ${scope.orgId} AND status = 'active'`,
  );

  const total = spend?.total ?? 0;
  const employees = staff?.n ?? 1;

  return {
    month,
    monthlySpendCents: total,
    annualRunRateCents: total * 12,
    momDelta: prior?.total ? (total - prior.total) / prior.total : 0,
    yoyDelta: prior12?.total ? (total - prior12.total) / prior12.total : 0,
    vendorCount: spend?.vendors ?? 0,
    seatsProvisioned: seats?.provisioned ?? 0,
    seatsActive: seats?.active ?? 0,
    overageMonthCents: spend?.overage ?? 0,
    overageTrailingCents: trailingOverage?.total ?? 0,
    dormantSeats: dormant?.n ?? 0,
    dormantAnnualCents: (dormant?.cents ?? 0) * 12,
    renewals90: renewals?.n ?? 0,
    renewals90ValueCents: renewals?.cents ?? 0,
    budgetCents: budget?.cents ?? 0,
    spendPerEmployeeCents: employees ? Math.round((total * 12) / employees) : 0,
    employees,
  };
}

// ------------------------------------------------------------------ trends

export type TrendPoint = {
  month: string;
  totalCents: number;
  baseCents: number;
  overageCents: number;
  seats: number;
};

export function spendTrend(scope: Scope, monthCount = 12): TrendPoint[] {
  const from = monthRange(monthCount)[0]!;
  return db.all<TrendPoint>(sql`
    SELECT i.period_month AS month,
           SUM(i.total_cents) AS totalCents,
           SUM(i.base_cents - i.credits_cents) AS baseCents,
           SUM(i.overage_cents) AS overageCents,
           COALESCE((SELECT SUM(u.provisioned_seats) FROM usage_snapshots u
                     JOIN vendors uv ON uv.id = u.vendor_id
                     WHERE u.period_month = i.period_month
                       AND ${scope.deptId ? sql`uv.org_id = ${scope.orgId} AND uv.department_id = ${scope.deptId}` : sql`uv.org_id = ${scope.orgId}`}), 0) AS seats
    FROM invoices i JOIN vendors v ON v.id = i.vendor_id
    WHERE ${scoped(scope)} AND i.period_month >= ${from}
    GROUP BY i.period_month
    ORDER BY i.period_month`);
}

export type SeatPoint = { month: string; provisioned: number; active: number };

export function seatTrend(scope: Scope, monthCount = 12): SeatPoint[] {
  const from = monthRange(monthCount)[0]!;
  return db.all<SeatPoint>(sql`
    SELECT u.period_month AS month,
           SUM(u.provisioned_seats) AS provisioned,
           SUM(u.active_seats) AS active
    FROM usage_snapshots u JOIN vendors v ON v.id = u.vendor_id
    WHERE ${scoped(scope)} AND u.period_month >= ${from}
    GROUP BY u.period_month
    ORDER BY u.period_month`);
}

export type CategorySpend = { category: string; cents: number; vendors: number };

export function spendByCategory(scope: Scope, month = currentMonth()): CategorySpend[] {
  return db.all<CategorySpend>(sql`
    SELECT v.category AS category,
           SUM(i.total_cents) AS cents,
           COUNT(DISTINCT v.id) AS vendors
    FROM invoices i JOIN vendors v ON v.id = i.vendor_id
    WHERE ${scoped(scope)} AND i.period_month = ${month}
    GROUP BY v.category
    ORDER BY cents DESC`);
}

// ------------------------------------------------------------------ vendors

export type VendorRow = {
  id: string;
  name: string;
  category: string;
  website: string;
  accentHue: number;
  status: string;
  riskTier: "low" | "medium" | "high";
  dataClassification: string;
  ssoEnforced: number;
  scimEnabled: number;
  department: string | null;
  ownerUserId: string | null;
  ownerName: string | null;
  notes: string | null;
  planName: string | null;
  termEnd: string | null;
  autoRenew: number | null;
  noticeDays: number | null;
  committedSeats: number | null;
  unitPriceCents: number | null;
  overageUnitPriceCents: number | null;
  annualCommitCents: number | null;
  uplift: number | null;
  monthCents: number;
  overageCents: number;
  provisioned: number;
  active: number;
  dormant: number;
  dormantCostCents: number;
};

export function vendorRows(scope: Scope, month = currentMonth()): VendorRow[] {
  return db.all<VendorRow>(sql`
    SELECT v.id, v.name, v.category, v.website, v.accent_hue AS accentHue, v.status,
           v.risk_tier AS riskTier, v.data_classification AS dataClassification,
           v.sso_enforced AS ssoEnforced, v.scim_enabled AS scimEnabled,
           d.name AS department, v.owner_user_id AS ownerUserId, u.name AS ownerName, v.notes,
           c.plan_name AS planName, c.term_end AS termEnd, c.auto_renew AS autoRenew,
           c.notice_days AS noticeDays, c.committed_seats AS committedSeats,
           c.unit_price_cents AS unitPriceCents, c.overage_unit_price_cents AS overageUnitPriceCents,
           c.annual_commit_cents AS annualCommitCents, c.uplift,
           COALESCE(i.total_cents, 0) AS monthCents,
           COALESCE(i.overage_cents, 0) AS overageCents,
           COALESCE(us.provisioned_seats, 0) AS provisioned,
           COALESCE(us.active_seats, 0) AS active,
           COALESCE(f.n, 0) AS dormant,
           COALESCE(f.cents, 0) AS dormantCostCents
    FROM vendors v
    LEFT JOIN departments d ON d.id = v.department_id
    LEFT JOIN users u ON u.id = v.owner_user_id
    LEFT JOIN contracts c ON c.vendor_id = v.id AND c.status = 'active'
    LEFT JOIN invoices i ON i.vendor_id = v.id AND i.period_month = ${month}
    LEFT JOIN usage_snapshots us ON us.vendor_id = v.id AND us.period_month = ${month}
    LEFT JOIN (SELECT vendor_id, COUNT(*) AS n, SUM(monthly_cost_cents) AS cents
               FROM seat_assignments WHERE status = 'flagged' GROUP BY vendor_id) f
      ON f.vendor_id = v.id
    WHERE ${scoped(scope)}
    ORDER BY monthCents DESC`);
}

export function vendorById(scope: Scope, vendorId: string, month = currentMonth()): VendorRow | undefined {
  return vendorRows(scope, month).find((v) => v.id === vendorId);
}

export function vendorHistory(vendorId: string, monthCount = 24) {
  const from = monthRange(monthCount)[0]!;
  return db.all<{
    month: string;
    totalCents: number;
    overageCents: number;
    provisioned: number;
    active: number;
  }>(sql`
    SELECT i.period_month AS month, i.total_cents AS totalCents, i.overage_cents AS overageCents,
           COALESCE(u.provisioned_seats, 0) AS provisioned, COALESCE(u.active_seats, 0) AS active
    FROM invoices i
    LEFT JOIN usage_snapshots u ON u.vendor_id = i.vendor_id AND u.period_month = i.period_month
    WHERE i.vendor_id = ${vendorId} AND i.period_month >= ${from}
    ORDER BY i.period_month`);
}

export function vendorInvoices(vendorId: string, limit = 12) {
  return db.all<{
    id: string;
    periodMonth: string;
    baseCents: number;
    overageCents: number;
    creditsCents: number;
    totalCents: number;
    status: string;
    issuedAt: string;
  }>(sql`
    SELECT id, period_month AS periodMonth, base_cents AS baseCents, overage_cents AS overageCents,
           credits_cents AS creditsCents, total_cents AS totalCents, status, issued_at AS issuedAt
    FROM invoices WHERE vendor_id = ${vendorId}
    ORDER BY period_month DESC LIMIT ${limit}`);
}

export type LedgerRow = {
  id: string;
  vendorId: string;
  vendorName: string;
  accentHue: number;
  category: string;
  department: string | null;
  periodMonth: string;
  baseCents: number;
  overageCents: number;
  creditsCents: number;
  totalCents: number;
  status: string;
  issuedAt: string;
};

export function ledger(scope: Scope, month = currentMonth()): LedgerRow[] {
  return db.all<LedgerRow>(sql`
    SELECT i.id, v.id AS vendorId, v.name AS vendorName, v.accent_hue AS accentHue, v.category,
           d.name AS department, i.period_month AS periodMonth, i.base_cents AS baseCents,
           i.overage_cents AS overageCents, i.credits_cents AS creditsCents,
           i.total_cents AS totalCents, i.status, i.issued_at AS issuedAt
    FROM invoices i
    JOIN vendors v ON v.id = i.vendor_id
    LEFT JOIN departments d ON d.id = v.department_id
    WHERE ${scoped(scope)} AND i.period_month = ${month}
    ORDER BY i.total_cents DESC`);
}

export function availableMonths(scope: Scope, limit = 24): string[] {
  return db
    .all<{ m: string }>(sql`
      SELECT DISTINCT i.period_month AS m
      FROM invoices i JOIN vendors v ON v.id = i.vendor_id
      WHERE ${scoped(scope)}
      ORDER BY m DESC LIMIT ${limit}`)
    .map((row) => row.m);
}

// ------------------------------------------------------------------ seats

export type SeatRow = {
  id: string;
  vendorId: string;
  vendorName: string;
  accentHue: number;
  employeeName: string;
  employeeEmail: string;
  employeeStatus: string;
  department: string;
  title: string;
  tier: string;
  assignedAt: string;
  lastActiveAt: string | null;
  monthlyCostCents: number;
  status: string;
  idleDays: number | null;
};

export function dormantSeats(
  scope: Scope,
  opts: { vendorId?: string; minIdleDays?: number; limit?: number; offboardedOnly?: boolean } = {},
): SeatRow[] {
  const minIdle = opts.minIdleDays ?? 30;
  return db.all<SeatRow>(sql`
    SELECT s.id, s.vendor_id AS vendorId, v.name AS vendorName, v.accent_hue AS accentHue,
           e.name AS employeeName, e.email AS employeeEmail, e.status AS employeeStatus,
           d.name AS department, e.title, s.tier, s.assigned_at AS assignedAt,
           s.last_active_at AS lastActiveAt, s.monthly_cost_cents AS monthlyCostCents, s.status,
           CAST(julianday('now') - julianday(s.last_active_at) AS INTEGER) AS idleDays
    FROM seat_assignments s
    JOIN vendors v ON v.id = s.vendor_id
    JOIN employees e ON e.id = s.employee_id
    JOIN departments d ON d.id = e.department_id
    WHERE ${scoped(scope)}
      AND s.status = 'flagged'
      ${opts.vendorId ? sql`AND s.vendor_id = ${opts.vendorId}` : sql``}
      ${opts.offboardedOnly ? sql`AND e.status = 'offboarded'` : sql``}
      AND (s.last_active_at IS NULL OR julianday('now') - julianday(s.last_active_at) >= ${minIdle})
    ORDER BY s.monthly_cost_cents DESC, idleDays DESC
    LIMIT ${opts.limit ?? 250}`);
}

export type ReclaimTarget = {
  vendorId: string;
  vendorName: string;
  accentHue: number;
  unitPriceCents: number;
  provisioned: number;
  active: number;
  dormant: number;
  offboarded: number;
  monthlyWasteCents: number;
};

export function reclaimTargets(scope: Scope, month = currentMonth()): ReclaimTarget[] {
  return db.all<ReclaimTarget>(sql`
    SELECT v.id AS vendorId, v.name AS vendorName, v.accent_hue AS accentHue,
           COALESCE(c.unit_price_cents, 0) AS unitPriceCents,
           COALESCE(u.provisioned_seats, 0) AS provisioned,
           COALESCE(u.active_seats, 0) AS active,
           SUM(CASE WHEN s.status = 'flagged' THEN 1 ELSE 0 END) AS dormant,
           SUM(CASE WHEN s.status = 'flagged' AND e.status = 'offboarded' THEN 1 ELSE 0 END) AS offboarded,
           SUM(CASE WHEN s.status = 'flagged' THEN s.monthly_cost_cents ELSE 0 END) AS monthlyWasteCents
    FROM vendors v
    JOIN seat_assignments s ON s.vendor_id = v.id
    JOIN employees e ON e.id = s.employee_id
    LEFT JOIN contracts c ON c.vendor_id = v.id AND c.status = 'active'
    LEFT JOIN usage_snapshots u ON u.vendor_id = v.id AND u.period_month = ${month}
    WHERE ${scoped(scope)}
    GROUP BY v.id
    HAVING monthlyWasteCents > 0
    ORDER BY monthlyWasteCents DESC`);
}

// ------------------------------------------------------------------ commitments

export type CommitmentRow = {
  vendorId: string;
  vendorName: string;
  accentHue: number;
  category: string;
  department: string | null;
  committedSeats: number;
  provisioned: number;
  active: number;
  unitPriceCents: number;
  overageUnitPriceCents: number;
  monthOverageCents: number;
  trailingOverageCents: number;
  overageMonths: number;
  termEnd: string;
  annualCommitCents: number;
};

export function commitments(scope: Scope, month = currentMonth()): CommitmentRow[] {
  const from = monthRange(12, new Date(`${month}-15T00:00:00Z`))[0]!;
  return db.all<CommitmentRow>(sql`
    SELECT v.id AS vendorId, v.name AS vendorName, v.accent_hue AS accentHue, v.category,
           d.name AS department,
           c.committed_seats AS committedSeats,
           c.unit_price_cents AS unitPriceCents,
           c.overage_unit_price_cents AS overageUnitPriceCents,
           c.term_end AS termEnd,
           c.annual_commit_cents AS annualCommitCents,
           COALESCE(u.provisioned_seats, 0) AS provisioned,
           COALESCE(u.active_seats, 0) AS active,
           COALESCE((SELECT overage_cents FROM invoices WHERE vendor_id = v.id AND period_month = ${month}), 0) AS monthOverageCents,
           COALESCE((SELECT SUM(overage_cents) FROM invoices WHERE vendor_id = v.id AND period_month >= ${from}), 0) AS trailingOverageCents,
           COALESCE((SELECT COUNT(*) FROM invoices WHERE vendor_id = v.id AND period_month >= ${from} AND overage_cents > 0), 0) AS overageMonths
    FROM vendors v
    JOIN contracts c ON c.vendor_id = v.id AND c.status = 'active'
    LEFT JOIN departments d ON d.id = v.department_id
    LEFT JOIN usage_snapshots u ON u.vendor_id = v.id AND u.period_month = ${month}
    WHERE ${scoped(scope)} AND c.committed_seats > 0
    ORDER BY trailingOverageCents DESC, (c.committed_seats - COALESCE(u.provisioned_seats, 0)) DESC`);
}

// ------------------------------------------------------------------ renewals

export type RenewalRow = {
  contractId: string;
  vendorId: string;
  vendorName: string;
  accentHue: number;
  category: string;
  planName: string;
  termEnd: string;
  noticeDays: number;
  autoRenew: number;
  annualCommitCents: number;
  uplift: number;
  committedSeats: number;
  provisioned: number;
  active: number;
  department: string | null;
  taskId: string | null;
  stage: string | null;
  ownerName: string | null;
  ownerUserId: string | null;
  targetSavingsCents: number | null;
  dueAt: string | null;
  notes: string | null;
  daysToRenewal: number;
  daysToNotice: number;
};

export function renewals(scope: Scope, withinDays = 400, month = currentMonth()): RenewalRow[] {
  return db.all<RenewalRow>(sql`
    SELECT c.id AS contractId, v.id AS vendorId, v.name AS vendorName, v.accent_hue AS accentHue,
           v.category, c.plan_name AS planName, c.term_end AS termEnd, c.notice_days AS noticeDays,
           c.auto_renew AS autoRenew, c.annual_commit_cents AS annualCommitCents, c.uplift,
           c.committed_seats AS committedSeats,
           COALESCE(u.provisioned_seats, 0) AS provisioned,
           COALESCE(u.active_seats, 0) AS active,
           d.name AS department,
           r.id AS taskId, r.stage, r.owner_user_id AS ownerUserId,
           usr.name AS ownerName, r.target_savings_cents AS targetSavingsCents,
           r.due_at AS dueAt, r.notes,
           CAST(julianday(c.term_end) - julianday('now') AS INTEGER) AS daysToRenewal,
           CAST(julianday(c.term_end) - julianday('now') AS INTEGER) - c.notice_days AS daysToNotice
    FROM contracts c
    JOIN vendors v ON v.id = c.vendor_id
    LEFT JOIN departments d ON d.id = v.department_id
    LEFT JOIN renewal_tasks r ON r.contract_id = c.id
    LEFT JOIN users usr ON usr.id = r.owner_user_id
    LEFT JOIN usage_snapshots u ON u.vendor_id = v.id AND u.period_month = ${month}
    WHERE ${scoped(scope)} AND c.status = 'active'
      AND julianday(c.term_end) - julianday('now') <= ${withinDays}
    ORDER BY c.term_end`);
}

// ------------------------------------------------------------------ budgets

export type BudgetRow = {
  id: string;
  name: string;
  costCenter: string;
  headcount: number;
  annualBudgetCents: number;
  monthCents: number;
  annualisedCents: number;
  vendors: number;
  ownerName: string | null;
};

export function budgets(scope: Scope, month = currentMonth()): BudgetRow[] {
  return db.all<BudgetRow>(sql`
    SELECT d.id, d.name, d.cost_center AS costCenter, d.headcount,
           d.annual_budget_cents AS annualBudgetCents,
           COALESCE(SUM(i.total_cents), 0) AS monthCents,
           COALESCE(SUM(i.total_cents), 0) * 12 AS annualisedCents,
           COUNT(DISTINCT v.id) AS vendors,
           u.name AS ownerName
    FROM departments d
    LEFT JOIN vendors v ON v.department_id = d.id
    LEFT JOIN invoices i ON i.vendor_id = v.id AND i.period_month = ${month}
    LEFT JOIN users u ON u.id = d.owner_user_id
    WHERE d.org_id = ${scope.orgId}
      ${scope.deptId ? sql`AND d.id = ${scope.deptId}` : sql``}
    GROUP BY d.id
    ORDER BY annualisedCents DESC`);
}

export function departmentTrend(scope: Scope, monthCount = 12) {
  const from = monthRange(monthCount)[0]!;
  return db.all<{ month: string; department: string; cents: number }>(sql`
    SELECT i.period_month AS month, d.name AS department, SUM(i.total_cents) AS cents
    FROM invoices i
    JOIN vendors v ON v.id = i.vendor_id
    JOIN departments d ON d.id = v.department_id
    WHERE ${scoped(scope)} AND i.period_month >= ${from}
    GROUP BY i.period_month, d.name
    ORDER BY i.period_month`);
}

// ------------------------------------------------------------------ shadow IT

export type ShadowRow = {
  id: string;
  appName: string;
  category: string;
  source: string;
  firstSeenAt: string;
  lastSeenAt: string;
  userCount: number;
  monthlySpendCents: number;
  riskScore: number;
  dataScopes: string | null;
  status: string;
  department: string | null;
  overlapsVendor: string | null;
};

export function shadowIt(scope: Scope): ShadowRow[] {
  return db.all<ShadowRow>(sql`
    SELECT f.id, f.app_name AS appName, f.category, f.source, f.first_seen_at AS firstSeenAt,
           f.last_seen_at AS lastSeenAt, f.user_count AS userCount,
           f.monthly_spend_cents AS monthlySpendCents, f.risk_score AS riskScore,
           f.data_scopes AS dataScopes, f.status, d.name AS department,
           ov.name AS overlapsVendor
    FROM shadow_it_findings f
    LEFT JOIN departments d ON d.id = f.department_id
    LEFT JOIN vendors ov ON ov.id = f.overlaps_vendor_id
    WHERE f.org_id = ${scope.orgId}
      ${scope.deptId ? sql`AND f.department_id = ${scope.deptId}` : sql``}
    ORDER BY f.risk_score DESC, f.monthly_spend_cents DESC`);
}

// ------------------------------------------------------------------ people

export function orgUsers(orgId: string) {
  return db.all<{
    id: string;
    email: string;
    name: string;
    title: string | null;
    role: string;
    status: string;
    lastLoginAt: string | null;
    department: string | null;
  }>(sql`
    SELECT u.id, u.email, u.name, u.title, u.role, u.status, u.last_login_at AS lastLoginAt,
           d.name AS department
    FROM users u LEFT JOIN departments d ON d.id = u.department_id
    WHERE u.org_id = ${orgId}
    ORDER BY u.name`);
}

export function departmentOptions(orgId: string) {
  return db.all<{ id: string; name: string }>(
    sql`SELECT id, name FROM departments WHERE org_id = ${orgId} ORDER BY name`,
  );
}

/** Portfolio-wide savings the product is currently claiming, one line per lever. */
export function savingsLevers(scope: Scope, month = currentMonth()) {
  const head = headline(scope, month);
  const targets = reclaimTargets(scope, month);
  const renewalRows = renewals(scope, 120, month);
  const shadow = shadowIt(scope);

  const duplicateSpend = shadow
    .filter((f) => f.overlapsVendor)
    .reduce((sum, f) => sum + f.monthlySpendCents * 12, 0);
  const negotiationTarget = renewalRows.reduce(
    (sum, r) => sum + (r.targetSavingsCents ?? 0),
    0,
  );
  const overCommitted = renewalRows
    .filter((r) => r.committedSeats > r.provisioned)
    .reduce(
      (sum, r) =>
        sum +
        (r.committedSeats - r.provisioned) *
          (vendorUnitPrice(r.vendorId) ?? 0) *
          12,
      0,
    );

  return {
    reclaimCents: targets.reduce((sum, t) => sum + t.monthlyWasteCents, 0) * 12,
    negotiationCents: negotiationTarget,
    duplicateCents: duplicateSpend,
    shelfwareCents: overCommitted,
    overageCents: head.overageTrailingCents,
  };
}

function vendorUnitPrice(vendorId: string): number | null {
  const row = db.get<{ cents: number }>(
    sql`SELECT unit_price_cents AS cents FROM contracts WHERE vendor_id = ${vendorId} AND status = 'active' LIMIT 1`,
  );
  return row?.cents ?? null;
}

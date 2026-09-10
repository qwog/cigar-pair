import { sql, relations } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Money is stored as integer cents everywhere. No floats touch a currency value.
 * Timestamps are ISO-8601 strings in UTC; dates without a time are `YYYY-MM-DD`.
 */

const id = () => text("id").primaryKey();
const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`);

export const organizations = sqliteTable("organizations", {
  id: id(),
  name: text("name").notNull(),
  domain: text("domain").notNull(),
  fiscalYearStartMonth: integer("fiscal_year_start_month").notNull().default(1),
  currency: text("currency").notNull().default("USD"),
  createdAt: createdAt(),
});

export const ROLES = ["admin", "finance", "it", "dept_owner", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const users = sqliteTable(
  "users",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name").notNull(),
    title: text("title"),
    role: text("role").$type<Role>().notNull().default("viewer"),
    departmentId: text("department_id"),
    passwordHash: text("password_hash").notNull(),
    status: text("status").$type<"active" | "disabled">().notNull().default("active"),
    lastLoginAt: text("last_login_at"),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockedUntil: text("locked_until"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_unique").on(t.email)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: id(), // sha-256 of the raw token; the raw token never lands in the database
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: text("expires_at").notNull(),
    userAgent: text("user_agent"),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const departments = sqliteTable(
  "departments",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    costCenter: text("cost_center").notNull(),
    ownerUserId: text("owner_user_id"),
    annualBudgetCents: integer("annual_budget_cents").notNull().default(0),
    headcount: integer("headcount").notNull().default(0),
  },
  (t) => [index("departments_org_idx").on(t.orgId)],
);

export const employees = sqliteTable(
  "employees",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    departmentId: text("department_id")
      .notNull()
      .references(() => departments.id),
    title: text("title").notNull(),
    status: text("status").$type<"active" | "offboarded">().notNull().default("active"),
    startedAt: text("started_at").notNull(),
    offboardedAt: text("offboarded_at"),
  },
  (t) => [
    index("employees_org_idx").on(t.orgId),
    index("employees_dept_idx").on(t.departmentId),
  ],
);

export const vendors = sqliteTable(
  "vendors",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category").notNull(),
    website: text("website").notNull(),
    accentHue: integer("accent_hue").notNull().default(0), // categorical slot 0-7
    ownerUserId: text("owner_user_id").references(() => users.id),
    departmentId: text("department_id").references(() => departments.id),
    status: text("status")
      .$type<"active" | "in_negotiation" | "cancelled" | "unsanctioned">()
      .notNull()
      .default("active"),
    riskTier: text("risk_tier").$type<"low" | "medium" | "high">().notNull().default("low"),
    dataClassification: text("data_classification")
      .$type<"public" | "internal" | "confidential" | "restricted">()
      .notNull()
      .default("internal"),
    ssoEnforced: integer("sso_enforced", { mode: "boolean" }).notNull().default(false),
    scimEnabled: integer("scim_enabled", { mode: "boolean" }).notNull().default(false),
    discoverySource: text("discovery_source").notNull().default("finance"),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [
    index("vendors_org_idx").on(t.orgId),
    uniqueIndex("vendors_org_name_unique").on(t.orgId, t.name),
  ],
);

export const contracts = sqliteTable(
  "contracts",
  {
    id: id(),
    vendorId: text("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    planName: text("plan_name").notNull(),
    termStart: text("term_start").notNull(),
    termEnd: text("term_end").notNull(),
    billingCycle: text("billing_cycle")
      .$type<"monthly" | "quarterly" | "annual">()
      .notNull()
      .default("annual"),
    autoRenew: integer("auto_renew", { mode: "boolean" }).notNull().default(true),
    noticeDays: integer("notice_days").notNull().default(30),
    committedSeats: integer("committed_seats").notNull().default(0),
    unitPriceCents: integer("unit_price_cents").notNull().default(0), // per seat per month
    overageUnitPriceCents: integer("overage_unit_price_cents").notNull().default(0),
    platformFeeCents: integer("platform_fee_cents").notNull().default(0), // per month
    annualCommitCents: integer("annual_commit_cents").notNull().default(0),
    uplift: real("uplift").notNull().default(0), // renewal uplift the vendor is asking for
    status: text("status")
      .$type<"active" | "expired" | "cancelled">()
      .notNull()
      .default("active"),
    owningDocumentUrl: text("owning_document_url"),
  },
  (t) => [
    index("contracts_vendor_idx").on(t.vendorId),
    index("contracts_term_end_idx").on(t.termEnd),
  ],
);

export const invoices = sqliteTable(
  "invoices",
  {
    id: id(),
    vendorId: text("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    contractId: text("contract_id").references(() => contracts.id, { onDelete: "set null" }),
    periodMonth: text("period_month").notNull(), // YYYY-MM
    baseCents: integer("base_cents").notNull().default(0),
    overageCents: integer("overage_cents").notNull().default(0),
    creditsCents: integer("credits_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    status: text("status")
      .$type<"paid" | "open" | "disputed">()
      .notNull()
      .default("paid"),
    issuedAt: text("issued_at").notNull(),
  },
  (t) => [
    index("invoices_vendor_idx").on(t.vendorId),
    index("invoices_month_idx").on(t.periodMonth),
    uniqueIndex("invoices_vendor_month_unique").on(t.vendorId, t.periodMonth),
  ],
);

export const seatAssignments = sqliteTable(
  "seat_assignments",
  {
    id: id(),
    vendorId: text("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    tier: text("tier").notNull().default("Standard"),
    assignedAt: text("assigned_at").notNull(),
    lastActiveAt: text("last_active_at"),
    status: text("status")
      .$type<"active" | "flagged" | "reclaimed">()
      .notNull()
      .default("active"),
    monthlyCostCents: integer("monthly_cost_cents").notNull().default(0),
    reclaimedAt: text("reclaimed_at"),
    reclaimedByUserId: text("reclaimed_by_user_id").references(() => users.id),
  },
  (t) => [
    index("seats_vendor_idx").on(t.vendorId),
    index("seats_employee_idx").on(t.employeeId),
    uniqueIndex("seats_vendor_employee_unique").on(t.vendorId, t.employeeId),
  ],
);

export const usageSnapshots = sqliteTable(
  "usage_snapshots",
  {
    id: id(),
    vendorId: text("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    periodMonth: text("period_month").notNull(),
    provisionedSeats: integer("provisioned_seats").notNull().default(0),
    activeSeats: integer("active_seats").notNull().default(0),
  },
  (t) => [
    uniqueIndex("usage_vendor_month_unique").on(t.vendorId, t.periodMonth),
    index("usage_month_idx").on(t.periodMonth),
  ],
);

export const renewalTasks = sqliteTable(
  "renewal_tasks",
  {
    id: id(),
    contractId: text("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    ownerUserId: text("owner_user_id").references(() => users.id),
    stage: text("stage")
      .$type<"not_started" | "scoping" | "negotiating" | "legal" | "signed" | "cancelling">()
      .notNull()
      .default("not_started"),
    targetSavingsCents: integer("target_savings_cents").notNull().default(0),
    dueAt: text("due_at").notNull(),
    notes: text("notes"),
    updatedAt: createdAt(),
  },
  (t) => [uniqueIndex("renewal_contract_unique").on(t.contractId)],
);

export const shadowItFindings = sqliteTable(
  "shadow_it_findings",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    appName: text("app_name").notNull(),
    category: text("category").notNull(),
    source: text("source").$type<"expense" | "sso" | "network" | "oauth_grant">().notNull(),
    firstSeenAt: text("first_seen_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
    userCount: integer("user_count").notNull().default(0),
    monthlySpendCents: integer("monthly_spend_cents").notNull().default(0),
    riskScore: integer("risk_score").notNull().default(0), // 0-100
    dataScopes: text("data_scopes"),
    status: text("status")
      .$type<"new" | "reviewing" | "approved" | "blocked" | "consolidated">()
      .notNull()
      .default("new"),
    departmentId: text("department_id").references(() => departments.id),
    overlapsVendorId: text("overlaps_vendor_id").references(() => vendors.id),
  },
  (t) => [index("shadow_org_idx").on(t.orgId)],
);

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: id(),
    orgId: text("org_id").notNull(),
    actorUserId: text("actor_user_id"),
    actorEmail: text("actor_email"),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    detail: text("detail"),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_org_idx").on(t.orgId), index("audit_created_idx").on(t.createdAt)],
);

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: integer("window_start").notNull(),
});

export const vendorRelations = relations(vendors, ({ many, one }) => ({
  contracts: many(contracts),
  invoices: many(invoices),
  seats: many(seatAssignments),
  usage: many(usageSnapshots),
  owner: one(users, { fields: [vendors.ownerUserId], references: [users.id] }),
  department: one(departments, { fields: [vendors.departmentId], references: [departments.id] }),
}));

export const contractRelations = relations(contracts, ({ one }) => ({
  vendor: one(vendors, { fields: [contracts.vendorId], references: [vendors.id] }),
  renewal: one(renewalTasks, { fields: [contracts.id], references: [renewalTasks.contractId] }),
}));

export type Vendor = typeof vendors.$inferSelect;
export type Contract = typeof contracts.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type SeatAssignment = typeof seatAssignments.$inferSelect;
export type Employee = typeof employees.$inferSelect;
export type Department = typeof departments.$inferSelect;
export type User = typeof users.$inferSelect;
export type ShadowItFinding = typeof shadowItFindings.$inferSelect;
export type RenewalTask = typeof renewalTasks.$inferSelect;

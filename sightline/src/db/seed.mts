/**
 * Deterministic demo seed. `npm run seed` rebuilds data/sightline.db from
 * scratch; every run produces byte-identical data because the PRNG is seeded.
 *
 *   node --experimental-strip-types src/db/seed.ts
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as s from "./schema.ts";
import {
  ORG,
  DEPARTMENTS,
  VENDORS,
  SHADOW_IT,
  FIRST_NAMES,
  LAST_NAMES,
  TITLES,
  DEMO_USERS,
  DEMO_PASSWORD,
  type VendorSeed,
} from "./catalog.ts";
import { hashPassword } from "../lib/password.ts";

// ------------------------------------------------------------ deterministic rng
let state = 0x9e3779b9;
function rnd(): number {
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (lo: number, hi: number) => lo + rnd() * (hi - lo);
const pick = <T,>(items: T[]): T => items[Math.floor(rnd() * items.length)]!;
const jitter = (spread: number) => 1 + between(-spread, spread);
function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

let counter = 0;
const id = (prefix: string) => `${prefix}_${(++counter).toString(36).padStart(6, "0")}`;

// ------------------------------------------------------------ dates
const NOW = new Date();
const HISTORY_MONTHS = 24;

const iso = (d: Date) => d.toISOString();
const day = (d: Date) => d.toISOString().slice(0, 10);
const monthKey = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const shiftDays = (base: Date, days: number) =>
  new Date(base.getTime() + days * 86_400_000);
const shiftMonths = (base: Date, months: number) =>
  new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + months, base.getUTCDate()));

const months: string[] = [];
for (let i = HISTORY_MONTHS - 1; i >= 0; i--) months.push(monthKey(shiftMonths(NOW, -i)));

// ------------------------------------------------------------ database
const file = path.resolve(process.cwd(), process.env.DATABASE_URL?.replace(/^file:/, "") ?? "./data/sightline.db");
fs.mkdirSync(path.dirname(file), { recursive: true });
for (const suffix of ["", "-wal", "-shm"]) {
  if (fs.existsSync(file + suffix)) fs.rmSync(file + suffix);
}
const sqlite = new Database(file);
sqlite.pragma("journal_mode = WAL");
const db = drizzle(sqlite, { schema: s });
migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });

// ------------------------------------------------------------ org + departments
const orgId = id("org");
db.insert(s.organizations)
  .values({
    id: orgId,
    name: ORG.name,
    domain: ORG.domain,
    fiscalYearStartMonth: ORG.fiscalYearStartMonth,
    currency: ORG.currency,
  })
  .run();

const deptIds = new Map<string, string>();
for (const dept of DEPARTMENTS) {
  const deptId = id("dep");
  deptIds.set(dept.name, deptId);
  db.insert(s.departments)
    .values({
      id: deptId,
      orgId,
      name: dept.name,
      costCenter: dept.costCenter,
      annualBudgetCents: dept.annualBudget * 100,
      headcount: dept.headcount,
    })
    .run();
}

// ------------------------------------------------------------ users
const passwordHash = await hashPassword(DEMO_PASSWORD);
const userIds = new Map<string, string>();
for (const user of DEMO_USERS) {
  const userId = id("usr");
  userIds.set(user.email, userId);
  db.insert(s.users)
    .values({
      id: userId,
      orgId,
      email: user.email,
      name: user.name,
      title: user.title,
      role: user.role,
      departmentId: deptIds.get(user.dept)!,
      passwordHash,
      lastLoginAt: iso(shiftDays(NOW, -Math.floor(between(0, 6)))),
    })
    .run();
}
const admin = { id: userIds.get(DEMO_USERS[0]!.email)!, email: DEMO_USERS[0]!.email };
const ownerFor = (deptName: string) => {
  if (deptName === "IT") return userIds.get("priya.nandan@arclight.systems")!;
  if (deptName === "Finance") return userIds.get("marcus.lin@arclight.systems")!;
  if (deptName === "Sales") return userIds.get("sofia.marchetti@arclight.systems")!;
  return admin.id;
};

for (const dept of DEPARTMENTS) {
  sqlite
    .prepare("UPDATE departments SET owner_user_id = ? WHERE id = ?")
    .run(ownerFor(dept.name), deptIds.get(dept.name)!);
}

// ------------------------------------------------------------ employees
type Emp = { id: string; dept: string; name: string; active: boolean };
const employees: Emp[] = [];
const usedEmails = new Set<string>();
for (const dept of DEPARTMENTS) {
  for (let i = 0; i < dept.headcount; i++) {
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    let email = `${first}.${last}`.toLowerCase();
    let n = 1;
    while (usedEmails.has(email)) email = `${first}.${last}${++n}`.toLowerCase();
    usedEmails.add(email);
    // ~3% of the directory is offboarded but still holding seats somewhere.
    const active = rnd() > 0.03;
    const empId = id("emp");
    employees.push({ id: empId, dept: dept.name, name: `${first} ${last}`, active });
    db.insert(s.employees)
      .values({
        id: empId,
        orgId,
        name: `${first} ${last}`,
        email: `${email}@${ORG.domain}`,
        departmentId: deptIds.get(dept.name)!,
        title: pick(TITLES[dept.name] ?? ["Team Member"]),
        status: active ? "active" : "offboarded",
        startedAt: day(shiftDays(NOW, -Math.floor(between(30, 2200)))),
        offboardedAt: active ? null : day(shiftDays(NOW, -Math.floor(between(8, 120)))),
      })
      .run();
  }
}
const byDept = new Map<string, Emp[]>();
for (const emp of employees) {
  if (!byDept.has(emp.dept)) byDept.set(emp.dept, []);
  byDept.get(emp.dept)!.push(emp);
}

// ------------------------------------------------------------ vendors, contracts, invoices, seats
const eligibleFor = (vendor: VendorSeed): Emp[] =>
  vendor.scope === "all"
    ? employees
    : vendor.scope.flatMap((deptName) => byDept.get(deptName) ?? []);

let seatRows = 0;
for (const vendor of VENDORS) {
  const vendorId = id("ven");
  const eligible = eligibleFor(vendor);
  const provisionedNow = Math.max(0, Math.round(eligible.length * vendor.adoption));
  const committed = Math.max(0, Math.round(provisionedNow * vendor.commitRatio));
  const unitCents = Math.round(vendor.unit * 100);
  const overageCents = Math.round((vendor.overageUnit ?? vendor.unit * 1.15) * 100);
  const platformCents = Math.round(vendor.platform * 100);
  const termEnd = shiftDays(NOW, vendor.renewalInDays);
  const termStart = shiftMonths(termEnd, -vendor.termMonths);

  db.insert(s.vendors)
    .values({
      id: vendorId,
      orgId,
      name: vendor.name,
      category: vendor.category,
      website: `https://${vendor.website}`,
      accentHue: vendor.hue,
      ownerUserId: ownerFor(vendor.owner),
      departmentId: deptIds.get(vendor.owner)!,
      status: "active",
      riskTier: vendor.risk,
      dataClassification: vendor.data,
      ssoEnforced: vendor.sso,
      scimEnabled: vendor.scim,
      discoverySource: vendor.sso ? "sso" : "finance",
      notes: null,
    })
    .run();

  const contractId = id("con");
  db.insert(s.contracts)
    .values({
      id: contractId,
      vendorId,
      planName: vendor.plan,
      termStart: day(termStart),
      termEnd: day(termEnd),
      billingCycle: vendor.termMonths >= 12 ? "annual" : "monthly",
      autoRenew: vendor.autoRenew,
      noticeDays: vendor.noticeDays,
      committedSeats: committed,
      unitPriceCents: unitCents,
      overageUnitPriceCents: overageCents,
      platformFeeCents: platformCents,
      annualCommitCents: (platformCents + committed * unitCents) * 12,
      uplift: vendor.uplift,
      status: "active",
      owningDocumentUrl: `https://vault.${ORG.domain}/contracts/${vendor.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    })
    .run();

  // Up to 24 months of usage + invoices, walking the seat count backwards by
  // growth. Vendors bought part-way through the window start billing then.
  const firstMonth = Math.max(0, months.length - (vendor.since ?? months.length));
  for (let i = firstMonth; i < months.length; i++) {
    const monthsAgo = months.length - 1 - i;
    const provisioned = Math.max(
      1,
      Math.round((provisionedNow / (1 + vendor.growth) ** monthsAgo) * jitter(0.015)),
    );
    const active = Math.max(
      0,
      Math.min(provisioned, Math.round(provisioned * vendor.utilization * jitter(0.05))),
    );
    db.insert(s.usageSnapshots)
      .values({
        id: id("usg"),
        vendorId,
        periodMonth: months[i]!,
        provisionedSeats: provisioned,
        activeSeats: active,
      })
      .run();

    const base = platformCents + Math.min(provisioned, committed) * unitCents;
    const overage = Math.max(0, provisioned - committed) * overageCents;
    // Occasional service credit, and a usage-fee wobble on platform contracts.
    const credits = rnd() < 0.05 ? Math.round(base * between(0.01, 0.06)) : 0;
    const usageWobble = platformCents > 0 ? Math.round(platformCents * between(-0.04, 0.12)) : 0;
    const total = base + overage + usageWobble - credits;
    const issued = new Date(`${months[i]!}-05T09:00:00Z`);
    db.insert(s.invoices)
      .values({
        id: id("inv"),
        vendorId,
        contractId,
        periodMonth: months[i]!,
        baseCents: base + usageWobble,
        overageCents: overage,
        creditsCents: credits,
        totalCents: total,
        status: monthsAgo === 0 ? (rnd() < 0.25 ? "open" : "paid") : rnd() < 0.02 ? "disputed" : "paid",
        issuedAt: iso(issued),
      })
      .run();
  }

  // Current seat roster. Offboarded staff keep their seat until it is reclaimed.
  const pool = shuffle(eligible).slice(0, provisionedNow);
  for (const emp of pool) {
    const stale = !emp.active || rnd() > vendor.utilization;
    const lastActive = stale
      ? emp.active
        ? shiftDays(NOW, -Math.floor(between(38, 260)))
        : shiftDays(NOW, -Math.floor(between(20, 180)))
      : shiftDays(NOW, -Math.floor(between(0, 16)));
    db.insert(s.seatAssignments)
      .values({
        id: id("sea"),
        vendorId,
        employeeId: emp.id,
        tier: unitCents > 8000 ? "Full" : unitCents > 2000 ? "Standard" : "Member",
        assignedAt: day(shiftDays(NOW, -Math.floor(between(20, 900)))),
        lastActiveAt: rnd() < 0.02 ? null : day(lastActive),
        status: stale ? "flagged" : "active",
        monthlyCostCents: unitCents,
      })
      .run();
    seatRows++;
  }

  // Renewal workflow rows for anything inside the two-quarter window.
  if (vendor.renewalInDays <= 190) {
    const stage =
      vendor.renewalInDays <= 21
        ? pick<s.RenewalTask["stage"]>(["legal", "negotiating", "cancelling"])
        : vendor.renewalInDays <= 70
          ? pick<s.RenewalTask["stage"]>(["negotiating", "scoping"])
          : pick<s.RenewalTask["stage"]>(["scoping", "not_started"]);
    const runRate = (platformCents + provisionedNow * unitCents) * 12;
    db.insert(s.renewalTasks)
      .values({
        id: id("ren"),
        contractId,
        ownerUserId: ownerFor(vendor.owner),
        stage,
        targetSavingsCents: Math.round(runRate * between(0.04, 0.24)),
        dueAt: day(shiftDays(termEnd, -vendor.noticeDays)),
        notes:
          stage === "negotiating"
            ? `Vendor opened at +${Math.round(vendor.uplift * 100)}%. Counter anchored on ${Math.round(vendor.utilization * 100)}% utilisation.`
            : stage === "cancelling"
              ? "Notice drafted; consolidating onto an existing tool."
              : stage === "legal"
                ? "Redlines with counsel — DPA and termination-for-convenience clause."
                : null,
      })
      .run();
  }
}

// ------------------------------------------------------------ shadow IT
for (const finding of SHADOW_IT) {
  db.insert(s.shadowItFindings)
    .values({
      id: id("shd"),
      orgId,
      appName: finding.app,
      category: finding.category,
      source: finding.source,
      firstSeenAt: day(shiftDays(NOW, -finding.daysKnown)),
      lastSeenAt: day(shiftDays(NOW, -Math.floor(between(0, 5)))),
      userCount: finding.users,
      monthlySpendCents: finding.monthlySpend * 100,
      riskScore: finding.risk,
      dataScopes: finding.scopes,
      status: finding.status,
      departmentId: deptIds.get(finding.dept)!,
      overlapsVendorId: null,
    })
    .run();
}
// Link overlaps once every vendor row exists.
for (const finding of SHADOW_IT) {
  if (!finding.overlaps) continue;
  const vendorRow = db.select().from(s.vendors).all().find((v) => v.name === finding.overlaps);
  if (!vendorRow) continue;
  const findingRow = db.select().from(s.shadowItFindings).all().find((f) => f.appName === finding.app);
  if (!findingRow) continue;
  sqlite
    .prepare("UPDATE shadow_it_findings SET overlaps_vendor_id = ? WHERE id = ?")
    .run(vendorRow.id, findingRow.id);
}

// ------------------------------------------------------------ audit trail
const AUDIT_SEED: [string, string, string][] = [
  ["seat.reclaim", "vendor", "Reclaimed 14 dormant Confluence seats"],
  ["contract.update", "contract", "Recorded counter-offer on Slack renewal"],
  ["shadow_it.status", "shadow_it_finding", "Otter.ai moved to Reviewing"],
  ["budget.update", "department", "Marketing FY budget raised to $720,000"],
  ["export.data", "report", "Exported vendor spend CSV"],
  ["user.invite", "user", "Invited controller@arclight.systems as Finance"],
  ["renewal.stage", "renewal_task", "Looker renewal moved to Negotiating"],
  ["vendor.update", "vendor", "Marked Dropbox for consolidation"],
];
for (let i = 0; i < AUDIT_SEED.length; i++) {
  const [action, entity, detail] = AUDIT_SEED[i]!;
  sqlite
    .prepare(
      "INSERT INTO audit_log (id, org_id, actor_user_id, actor_email, action, entity, entity_id, detail, ip, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    )
    .run(
      id("aud"),
      orgId,
      admin.id,
      admin.email,
      action,
      entity,
      null,
      detail,
      "10.42.0.11",
      iso(shiftDays(NOW, -(i + 1) * 0.7)),
    );
}

const count = (table: string) =>
  (sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

console.log(`Sightline demo data written to ${file}`);
console.table({
  departments: count("departments"),
  employees: count("employees"),
  vendors: count("vendors"),
  contracts: count("contracts"),
  invoices: count("invoices"),
  usage_snapshots: count("usage_snapshots"),
  seat_assignments: seatRows,
  renewal_tasks: count("renewal_tasks"),
  shadow_it_findings: count("shadow_it_findings"),
  users: count("users"),
});
console.log(`\nSign in with any of:\n${DEMO_USERS.map((u) => `  ${u.email}  (${u.role})`).join("\n")}\nPassword: ${DEMO_PASSWORD}`);
sqlite.close();

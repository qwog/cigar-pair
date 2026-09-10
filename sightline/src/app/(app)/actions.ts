"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  departments,
  renewalTasks,
  seatAssignments,
  shadowItFindings,
  users,
  vendors,
  contracts,
  ROLES,
} from "@/db/schema";
import { assertCsrf, ForbiddenError, requireUser } from "@/lib/auth";
import { assertCan, departmentScope } from "@/lib/rbac";
import { hashPassword, passwordProblems } from "@/lib/password";
import { newId } from "@/lib/id";
import * as audit from "@/lib/audit";

export type ActionState = { ok?: string; error?: string };

/** Wraps every mutation: CSRF, capability, validation and audit in one place. */
async function guard<T>(formData: FormData, capability: Parameters<typeof assertCan>[1], run: (user: Awaited<ReturnType<typeof requireUser>>) => Promise<T> | T): Promise<ActionState> {
  try {
    const user = await requireUser();
    await assertCsrf(formData);
    assertCan(user, capability);
    const result = await run(user);
    return typeof result === "string" ? { ok: result } : { ok: "Saved." };
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: error.message };
    if (error instanceof z.ZodError) return { error: error.issues[0]?.message ?? "Check the form." };
    if (error instanceof Error && error.message.startsWith("NEXT_")) throw error;
    // Anything else is unexpected: log it server-side, and hand the client a
    // fixed message so database or framework internals are never echoed back.
    console.error("[sightline] action failed", error);
    return { error: "That change could not be saved. Try again, or contact an administrator." };
  }
}

/** Confirms a row belongs to the caller's org (and department, when scoped). */
function assertVendorInScope(user: Awaited<ReturnType<typeof requireUser>>, vendorId: string) {
  const vendor = db.select().from(vendors).where(eq(vendors.id, vendorId)).get();
  if (!vendor || vendor.orgId !== user.orgId) throw new ForbiddenError("Vendor not found.");
  const scope = departmentScope(user);
  if (scope && vendor.departmentId !== scope) throw new ForbiddenError("Vendor is outside your department.");
  return vendor;
}

// ------------------------------------------------------------------ seats

export async function reclaimSeats(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return guard(formData, "seat.reclaim", async (user) => {
    const ids = formData.getAll("seatId").map(String).filter(Boolean);
    z.array(z.string().min(3)).min(1, "Select at least one seat.").max(500).parse(ids);

    const rows = db
      .select({ id: seatAssignments.id, vendorId: seatAssignments.vendorId, cost: seatAssignments.monthlyCostCents })
      .from(seatAssignments)
      .innerJoin(vendors, eq(vendors.id, seatAssignments.vendorId))
      .where(and(inArray(seatAssignments.id, ids), eq(vendors.orgId, user.orgId)))
      .all();
    if (rows.length === 0) throw new ForbiddenError("Those seats are not in your portfolio.");
    for (const row of rows) assertVendorInScope(user, row.vendorId);

    db.update(seatAssignments)
      .set({
        status: "reclaimed",
        reclaimedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
        reclaimedByUserId: user.id,
      })
      .where(inArray(seatAssignments.id, rows.map((row) => row.id)))
      .run();

    const monthly = rows.reduce((sum, row) => sum + row.cost, 0);
    await audit.record(user, "seat.reclaim", "seat_assignment", null, `${rows.length} seats, $${(monthly * 12 / 100).toFixed(0)}/yr`);
    revalidatePath("/seats");
    revalidatePath("/dashboard");
    return `Reclaimed ${rows.length} seat${rows.length === 1 ? "" : "s"} — $${((monthly * 12) / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })} a year.`;
  });
}

// ------------------------------------------------------------------ renewals

const renewalSchema = z.object({
  contractId: z.string().min(3),
  stage: z.enum(["not_started", "scoping", "negotiating", "legal", "signed", "cancelling"]),
  ownerUserId: z.string().min(3).or(z.literal("")),
  notes: z.string().max(2000).optional(),
});

export async function saveRenewal(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return guard(formData, "renewal.manage", async (user) => {
    const input = renewalSchema.parse({
      contractId: formData.get("contractId"),
      stage: formData.get("stage"),
      ownerUserId: formData.get("ownerUserId") ?? "",
      notes: formData.get("notes") ?? "",
    });

    const contract = db.select().from(contracts).where(eq(contracts.id, input.contractId)).get();
    if (!contract) throw new ForbiddenError("Contract not found.");
    assertVendorInScope(user, contract.vendorId);

    if (input.ownerUserId) {
      const owner = db.select().from(users).where(eq(users.id, input.ownerUserId)).get();
      if (!owner || owner.orgId !== user.orgId) throw new ForbiddenError("Unknown owner.");
    }

    const existing = db.select().from(renewalTasks).where(eq(renewalTasks.contractId, contract.id)).get();
    const values = {
      stage: input.stage,
      ownerUserId: input.ownerUserId || null,
      notes: input.notes?.trim() || null,
      updatedAt: new Date().toISOString(),
    };

    if (existing) {
      db.update(renewalTasks).set(values).where(eq(renewalTasks.id, existing.id)).run();
    } else {
      db.insert(renewalTasks)
        .values({
          id: newId("ren"),
          contractId: contract.id,
          dueAt: contract.termEnd,
          targetSavingsCents: 0,
          ...values,
        })
        .run();
    }

    await audit.record(user, "renewal.update", "contract", contract.id, `stage ${input.stage}`);
    revalidatePath("/renewals");
    revalidatePath("/dashboard");
    return "Renewal updated.";
  });
}

// ------------------------------------------------------------------ shadow IT

export async function setFindingStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return guard(formData, "shadow_it.triage", async (user) => {
    const input = z
      .object({
        findingId: z.string().min(3),
        status: z.enum(["new", "reviewing", "approved", "blocked", "consolidated"]),
      })
      .parse({ findingId: formData.get("findingId"), status: formData.get("status") });

    const finding = db.select().from(shadowItFindings).where(eq(shadowItFindings.id, input.findingId)).get();
    if (!finding || finding.orgId !== user.orgId) throw new ForbiddenError("Finding not found.");

    db.update(shadowItFindings).set({ status: input.status }).where(eq(shadowItFindings.id, finding.id)).run();
    await audit.record(user, "shadow_it.status", "shadow_it_finding", finding.id, `${finding.appName} → ${input.status}`);
    revalidatePath("/shadow-it");
    revalidatePath("/dashboard");
    return `${finding.appName} marked ${input.status}.`;
  });
}

// ------------------------------------------------------------------ budgets

export async function saveBudget(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return guard(formData, "budget.edit", async (user) => {
    const input = z
      .object({
        departmentId: z.string().min(3),
        annualBudget: z.coerce.number().min(0).max(1_000_000_000),
      })
      .parse({ departmentId: formData.get("departmentId"), annualBudget: formData.get("annualBudget") });

    const department = db.select().from(departments).where(eq(departments.id, input.departmentId)).get();
    if (!department || department.orgId !== user.orgId) throw new ForbiddenError("Department not found.");

    db.update(departments)
      .set({ annualBudgetCents: Math.round(input.annualBudget * 100) })
      .where(eq(departments.id, department.id))
      .run();

    await audit.record(user, "budget.update", "department", department.id, `${department.name} → $${input.annualBudget.toLocaleString("en-US")}`);
    revalidatePath("/budgets");
    revalidatePath("/dashboard");
    return `${department.name} budget updated.`;
  });
}

// ------------------------------------------------------------------ vendors

export async function saveVendor(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return guard(formData, "vendor.edit", async (user) => {
    const input = z
      .object({
        vendorId: z.string().min(3),
        ownerUserId: z.string().min(3).or(z.literal("")),
        status: z.enum(["active", "in_negotiation", "cancelled", "unsanctioned"]),
        riskTier: z.enum(["low", "medium", "high"]),
        notes: z.string().max(2000).optional(),
      })
      .parse({
        vendorId: formData.get("vendorId"),
        ownerUserId: formData.get("ownerUserId") ?? "",
        status: formData.get("status"),
        riskTier: formData.get("riskTier"),
        notes: formData.get("notes") ?? "",
      });

    const vendor = assertVendorInScope(user, input.vendorId);
    db.update(vendors)
      .set({
        ownerUserId: input.ownerUserId || null,
        status: input.status,
        riskTier: input.riskTier,
        notes: input.notes?.trim() || null,
      })
      .where(eq(vendors.id, vendor.id))
      .run();

    await audit.record(user, "vendor.update", "vendor", vendor.id, `${vendor.name} → ${input.status}/${input.riskTier}`);
    revalidatePath(`/vendors/${vendor.id}`);
    revalidatePath("/vendors");
    return `${vendor.name} updated.`;
  });
}

// ------------------------------------------------------------------ users

export async function inviteUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return guard(formData, "user.manage", async (user) => {
    const input = z
      .object({
        email: z.string().trim().toLowerCase().email(),
        name: z.string().trim().min(2).max(120),
        role: z.enum(ROLES),
        departmentId: z.string().or(z.literal("")),
        password: z.string(),
      })
      .parse({
        email: formData.get("email"),
        name: formData.get("name"),
        role: formData.get("role"),
        departmentId: formData.get("departmentId") ?? "",
        password: formData.get("password") ?? "",
      });

    const problems = passwordProblems(input.password);
    if (problems.length) throw new ForbiddenError(problems.join(" "));

    const existing = db.select().from(users).where(eq(users.email, input.email)).get();
    if (existing) throw new ForbiddenError("That email already has an account.");

    if (input.departmentId) {
      const department = db.select().from(departments).where(eq(departments.id, input.departmentId)).get();
      if (!department || department.orgId !== user.orgId) throw new ForbiddenError("Unknown department.");
    }

    db.insert(users)
      .values({
        id: newId("usr"),
        orgId: user.orgId,
        email: input.email,
        name: input.name,
        role: input.role,
        departmentId: input.departmentId || null,
        passwordHash: await hashPassword(input.password),
      })
      .run();

    await audit.record(user, "user.invite", "user", null, `${input.email} as ${input.role}`);
    revalidatePath("/settings/users");
    return `${input.email} can now sign in as ${input.role}.`;
  });
}

export async function updateUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return guard(formData, "user.manage", async (user) => {
    const input = z
      .object({
        userId: z.string().min(3),
        role: z.enum(ROLES),
        status: z.enum(["active", "disabled"]),
      })
      .parse({ userId: formData.get("userId"), role: formData.get("role"), status: formData.get("status") });

    const target = db.select().from(users).where(eq(users.id, input.userId)).get();
    if (!target || target.orgId !== user.orgId) throw new ForbiddenError("User not found.");
    if (target.id === user.id && (input.role !== "admin" || input.status !== "active")) {
      throw new ForbiddenError("You cannot remove your own administrator access.");
    }
    const admins = db
      .select({ n: sql<number>`COUNT(*)` })
      .from(users)
      .where(and(eq(users.orgId, user.orgId), eq(users.role, "admin"), eq(users.status, "active")))
      .get();
    if (target.role === "admin" && input.role !== "admin" && (admins?.n ?? 0) <= 1) {
      throw new ForbiddenError("Keep at least one active administrator.");
    }

    db.update(users).set({ role: input.role, status: input.status }).where(eq(users.id, target.id)).run();
    await audit.record(user, "user.update", "user", target.id, `${target.email} → ${input.role}/${input.status}`);
    revalidatePath("/settings/users");
    return `${target.name} updated.`;
  });
}

import "server-only";
import type { Role } from "@/db/schema";
import { ForbiddenError, type SessionUser } from "@/lib/auth";

/**
 * One capability list per role. Pages and server actions ask for a capability,
 * never for a role name, so adding a role is a single edit here.
 */
export const CAPABILITIES = {
  "spend.view": ["admin", "finance", "it", "dept_owner", "viewer"],
  "spend.view_all_departments": ["admin", "finance", "it", "viewer"],
  "vendor.edit": ["admin", "it"],
  "contract.edit": ["admin", "finance"],
  "renewal.manage": ["admin", "finance", "it", "dept_owner"],
  "seat.reclaim": ["admin", "it"],
  "shadow_it.triage": ["admin", "it"],
  "budget.edit": ["admin", "finance"],
  "user.manage": ["admin"],
  "audit.view": ["admin", "finance"],
  "export.data": ["admin", "finance", "it"],
} as const satisfies Record<string, readonly Role[]>;

export type Capability = keyof typeof CAPABILITIES;

export function can(user: Pick<SessionUser, "role">, capability: Capability): boolean {
  return (CAPABILITIES[capability] as readonly Role[]).includes(user.role);
}

export function assertCan(user: Pick<SessionUser, "role">, capability: Capability): void {
  if (!can(user, capability)) {
    throw new ForbiddenError(`Your role (${ROLE_LABEL[user.role]}) cannot perform this action.`);
  }
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrator",
  finance: "Finance",
  it: "IT operations",
  dept_owner: "Department owner",
  viewer: "Viewer",
};

export const ROLE_BLURB: Record<Role, string> = {
  admin: "Full access, including user management and audit history.",
  finance: "Spend, contracts, budgets and renewals across every department.",
  it: "Vendors, seats, reclamation and shadow IT triage.",
  dept_owner: "Read-only outside their own department; owns their renewals.",
  viewer: "Read-only across the portfolio.",
};

/**
 * Department owners are the only scoped role: they see their own cost centre and
 * nothing else. Every other role reads the whole portfolio (viewers read-only).
 */
export function departmentScope(user: SessionUser): string | null {
  return can(user, "spend.view_all_departments") ? null : user.departmentId;
}

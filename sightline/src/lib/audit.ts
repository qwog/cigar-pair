import "server-only";
import { headers } from "next/headers";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { newId } from "@/lib/id";
import { clientIp, type SessionUser } from "@/lib/auth";

export async function record(
  actor: Pick<SessionUser, "id" | "email" | "orgId"> | null,
  action: string,
  entity: string,
  entityId: string | null,
  detail?: string,
): Promise<void> {
  const h = await headers();
  db.insert(auditLog)
    .values({
      id: newId("aud"),
      orgId: actor?.orgId ?? "unknown",
      actorUserId: actor?.id ?? null,
      actorEmail: actor?.email ?? null,
      action,
      entity,
      entityId,
      detail: detail ?? null,
      ip: clientIp(h),
    })
    .run();
}

export function recentEvents(orgId: string, limit = 100) {
  return db
    .select()
    .from(auditLog)
    .where(eq(auditLog.orgId, orgId))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit)
    .all();
}

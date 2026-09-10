import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";

export type RateVerdict = { ok: boolean; retryAfterSeconds: number; remaining: number };

/**
 * Fixed-window counter kept in the database so limits survive a restart and hold
 * across processes. Keys are caller-supplied and always namespaced.
 */
export function consume(key: string, limit: number, windowSeconds: number): RateVerdict {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % windowSeconds);
  const row = db
    .insert(rateLimits)
    .values({ key, count: 1, windowStart })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE WHEN ${rateLimits.windowStart} = ${windowStart} THEN ${rateLimits.count} + 1 ELSE 1 END`,
        windowStart: sql`${windowStart}`,
      },
    })
    .returning()
    .get();

  const used = row?.count ?? 1;
  return {
    ok: used <= limit,
    remaining: Math.max(0, limit - used),
    retryAfterSeconds: windowStart + windowSeconds - now,
  };
}

export function reset(key: string): void {
  db.delete(rateLimits).where(sql`${rateLimits.key} = ${key}`).run();
}

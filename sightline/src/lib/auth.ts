import "server-only";
import { createHash, randomBytes, timingSafeEqual, createHmac } from "node:crypto";
import { cookies, headers } from "next/headers";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, organizations, departments } from "@/db/schema";
import type { Role } from "@/db/schema";

const SESSION_COOKIE = "sl_session";
const CSRF_COOKIE = "sl_csrf";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const IDLE_REFRESH_MS = 1000 * 60 * 60; // slide the window at most hourly

function secret(): string {
  const value = process.env.SIGHTLINE_SECRET;
  if (value && value.length >= 32) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SIGHTLINE_SECRET must be set to a 32+ character value in production.");
  }
  // Development fallback so `npm run dev` works from a fresh clone.
  return "sightline-development-only-secret-key-0000";
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  title: string | null;
  role: Role;
  orgId: string;
  orgName: string;
  departmentId: string | null;
  departmentName: string | null;
};

export async function createSession(userId: string): Promise<void> {
  const raw = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const h = await headers();
  db.insert(sessions)
    .values({
      id: sha256(raw),
      userId,
      expiresAt,
      userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
      ip: clientIp(h),
    })
    .run();

  const jar = await cookies();
  jar.set(SESSION_COOKIE, raw, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  jar.set(CSRF_COOKIE, issueCsrfToken(sha256(raw)), {
    httpOnly: false, // read by the form component to mint a hidden field
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (raw) db.delete(sessions).where(eq(sessions.id, sha256(raw))).run();
  jar.delete(SESSION_COOKIE);
  jar.delete(CSRF_COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  // Opportunistic cleanup of anything already past its expiry.
  db.delete(sessions).where(lt(sessions.expiresAt, new Date().toISOString())).run();

  const row = db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      id: users.id,
      email: users.email,
      name: users.name,
      title: users.title,
      role: users.role,
      status: users.status,
      orgId: users.orgId,
      orgName: organizations.name,
      departmentId: users.departmentId,
      departmentName: departments.name,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(organizations, eq(organizations.id, users.orgId))
    .leftJoin(departments, eq(departments.id, users.departmentId))
    .where(and(eq(sessions.id, sha256(raw))))
    .get();

  if (!row) return null;
  if (row.status !== "active") return null;
  if (new Date(row.expiresAt).getTime() <= Date.now()) return null;

  // Slide the expiry window, but not on every single request.
  const remaining = new Date(row.expiresAt).getTime() - Date.now();
  if (SESSION_TTL_MS - remaining > IDLE_REFRESH_MS) {
    db.update(sessions)
      .set({ expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString() })
      .where(eq(sessions.id, row.sessionId))
      .run();
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    title: row.title,
    role: row.role,
    orgId: row.orgId,
    orgName: row.orgName,
    departmentId: row.departmentId,
    departmentName: row.departmentName,
  };
}

/** Throws when there is no session — route handlers and actions call this first. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError("Not signed in.");
  return user;
}

export class AuthError extends Error {}
export class ForbiddenError extends Error {}

// ---------------------------------------------------------------- CSRF

function issueCsrfToken(sessionKey: string): string {
  const nonce = randomBytes(16).toString("base64url");
  const mac = createHmac("sha256", secret()).update(`${sessionKey}.${nonce}`).digest("base64url");
  return `${nonce}.${mac}`;
}

export async function currentCsrfToken(): Promise<string> {
  const jar = await cookies();
  return jar.get(CSRF_COOKIE)?.value ?? "";
}

/**
 * Double-submit check bound to the session: the token in the form body must
 * match the cookie AND carry a valid HMAC over the session key, so a token
 * lifted from another session is rejected.
 */
export async function assertCsrf(submitted: FormData | string | null): Promise<void> {
  const token = typeof submitted === "string" ? submitted : (submitted?.get("csrf") as string | null);
  const jar = await cookies();
  const cookieToken = jar.get(CSRF_COOKIE)?.value;
  const rawSession = jar.get(SESSION_COOKIE)?.value;
  if (!token || !cookieToken || !rawSession) throw new ForbiddenError("Missing CSRF token.");

  const a = Buffer.from(token);
  const b = Buffer.from(cookieToken);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new ForbiddenError("Bad CSRF token.");

  const [nonce, mac] = token.split(".");
  if (!nonce || !mac) throw new ForbiddenError("Malformed CSRF token.");
  const expected = createHmac("sha256", secret())
    .update(`${sha256(rawSession)}.${nonce}`)
    .digest("base64url");
  const x = Buffer.from(mac);
  const y = Buffer.from(expected);
  if (x.length !== y.length || !timingSafeEqual(x, y)) throw new ForbiddenError("Bad CSRF token.");

  // Origin check: a same-site POST from another origin fails here.
  const h = await headers();
  const origin = h.get("origin");
  const host = h.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) throw new ForbiddenError("Cross-origin request refused.");
    } catch {
      throw new ForbiddenError("Cross-origin request refused.");
    }
  }
}

export function clientIp(h: Headers): string | null {
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim().slice(0, 64);
  return h.get("x-real-ip")?.slice(0, 64) ?? null;
}

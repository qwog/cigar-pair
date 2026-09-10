"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, clientIp, destroySession } from "@/lib/auth";
import { dummyVerify, verifyPassword } from "@/lib/password";
import { consume, reset } from "@/lib/rate-limit";
import * as audit from "@/lib/audit";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid work email."),
  password: z.string().min(1, "Enter your password."),
});

export type LoginState = { error?: string; email?: string };

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const h = await headers();
  const origin = h.get("origin");
  const host = h.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return { error: "Request refused." };
  }

  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the details and try again.",
      email: String(formData.get("email") ?? ""),
    };
  }
  const { email, password } = parsed.data;

  const ip = clientIp(h) ?? "unknown";
  const byIp = consume(`login:ip:${ip}`, 20, 900);
  const byEmail = consume(`login:email:${email}`, 8, 900);
  if (!byIp.ok || !byEmail.ok) {
    await audit.record(null, "auth.rate_limited", "user", null, email);
    return {
      error: `Too many attempts. Try again in ${Math.ceil(Math.max(byIp.retryAfterSeconds, byEmail.retryAfterSeconds) / 60)} minutes.`,
      email,
    };
  }

  const user = db.select().from(users).where(eq(users.email, email)).get();

  // Same generic message and comparable timing whether or not the account exists.
  const GENERIC = "That email and password combination is not recognised.";

  if (!user) {
    await dummyVerify();
    return { error: GENERIC, email };
  }
  if (user.status !== "active") {
    await dummyVerify();
    return { error: "This account has been disabled. Contact your Sightline administrator.", email };
  }
  if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
    await dummyVerify();
    const minutes = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000);
    return { error: `Account temporarily locked. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`, email };
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const attempts = user.failedAttempts + 1;
    db.update(users)
      .set({
        failedAttempts: attempts,
        lockedUntil:
          attempts >= MAX_ATTEMPTS
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString()
            : null,
      })
      .where(eq(users.id, user.id))
      .run();
    await audit.record(
      { id: user.id, email: user.email, orgId: user.orgId },
      "auth.failed",
      "user",
      user.id,
      `attempt ${attempts} of ${MAX_ATTEMPTS}`,
    );
    return { error: GENERIC, email };
  }

  db.update(users)
    .set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))` })
    .where(eq(users.id, user.id))
    .run();
  reset(`login:email:${email}`);

  await createSession(user.id);
  await audit.record({ id: user.id, email: user.email, orgId: user.orgId }, "auth.login", "user", user.id);
  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/login");
}

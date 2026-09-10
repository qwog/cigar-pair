import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { DEMO_PASSWORD, DEMO_USERS, ORG } from "@/db/catalog";
import { ROLE_BLURB, ROLE_LABEL } from "@/lib/rbac";
import { Wordmark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const PROOF = [
  ["$5.9M", "annual SaaS run-rate under management"],
  ["46", "vendors, contracts and renewal dates in one ledger"],
  ["$734K", "dormant-seat spend surfaced for reclamation"],
];

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/dashboard");

  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <section
        className="relative hidden overflow-hidden px-12 py-14 lg:flex lg:flex-col lg:justify-between"
        style={{ background: "var(--rail)", borderRight: "1px solid var(--line)" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full"
          style={{ background: "var(--accent-soft)", filter: "blur(40px)" }}
        />
        <div className="relative">
          <Wordmark size={30} />
          <h1
            className="mt-14 max-w-lg text-[34px] font-semibold leading-[1.15] tracking-[-0.03em]"
            style={{ color: "var(--ink)" }}
          >
            Every seat, dollar and renewal date your company is committed to — on one screen.
          </h1>
          <p className="mt-4 max-w-md text-[14px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
            Sightline reconciles invoices, identity providers and contracts into a single ledger, then tells
            you what to cancel, reclaim and renegotiate before the next auto-renewal fires.
          </p>
        </div>

        <dl className="relative mt-12 grid grid-cols-3 gap-6">
          {PROOF.map(([value, label]) => (
            <div key={label}>
              <dt className="text-[26px] font-semibold tracking-[-0.02em]" style={{ color: "var(--ink)" }}>
                {value}
              </dt>
              <dd className="mt-1 text-[12px] leading-snug" style={{ color: "var(--ink-3)" }}>
                {label}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Sign-in panel */}
      <section className="flex min-h-dvh flex-col px-6 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <span className="lg:hidden">
            <Wordmark />
          </span>
          <span className="hidden lg:block" />
          <ThemeToggle />
        </div>

        <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center py-10">
          <h2 className="text-[20px] font-semibold tracking-[-0.02em]" style={{ color: "var(--ink)" }}>
            Sign in to {ORG.name}
          </h2>
          <p className="mb-6 mt-1 text-[13px]" style={{ color: "var(--ink-3)" }}>
            Sessions last 12 hours. Five failed attempts locks the account for 15 minutes.
          </p>

          <LoginForm demoPassword={DEMO_PASSWORD} />

          <div className="mt-8 rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
            <p className="eyebrow">Demo accounts</p>
            <p className="mt-1.5 text-[12px]" style={{ color: "var(--ink-3)" }}>
              Each role sees a different slice of the same data. Password for all:{" "}
              <code
                className="rounded px-1.5 py-0.5 text-[11px]"
                style={{ background: "var(--surface-3)", color: "var(--ink)" }}
              >
                {DEMO_PASSWORD}
              </code>
            </p>
            <ul className="mt-3 space-y-2">
              {DEMO_USERS.map((user) => (
                <li key={user.email} className="text-[12px]">
                  <span className="font-semibold" style={{ color: "var(--ink)" }}>
                    {user.email}
                  </span>
                  <span style={{ color: "var(--ink-3)" }}> — {ROLE_LABEL[user.role]}</span>
                  <p className="mt-0.5" style={{ color: "var(--ink-3)" }}>
                    {ROLE_BLURB[user.role]}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="text-center text-[11px]" style={{ color: "var(--ink-3)" }}>
          Demonstration environment. {ORG.name} and its portfolio figures are fictional.
        </p>
      </section>
    </main>
  );
}

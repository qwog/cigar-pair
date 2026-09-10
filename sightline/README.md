# Sightline

**The SaaS control plane.** Every vendor, seat, dollar, overage and renewal date a
company is committed to, reconciled into one ledger — with the levers to act on it.

Sightline is a complete, working product, not a mockup: real authentication, real
role-based access control, a normalised relational schema, server-side aggregation
and audited mutations. It ships with a seeded demo tenant — *Arclight Systems*, a
fictional 640-person robotics manufacturer running 46 SaaS vendors on a $5.9M
annual run-rate.

---

## Run it

```bash
npm install
cp .env.example .env.local     # then set SIGHTLINE_SECRET
npm run seed                   # builds data/sightline.db from scratch
npm run dev                    # http://localhost:3000
```

`npm run seed` is deterministic — the same portfolio every time — and safe to re-run
whenever you want to reset the demo.

### Demo accounts

Password for all five: `Sightline!Demo2026`

| Email | Role | What they see |
|---|---|---|
| `dana.reyes@arclight.systems` | Administrator | Everything, including users and the audit log |
| `marcus.lin@arclight.systems` | Finance | Spend, contracts, budgets, renewals, audit |
| `priya.nandan@arclight.systems` | IT operations | Vendors, seats, reclamation, shadow IT |
| `sofia.marchetti@arclight.systems` | Department owner | **Sales only** — scoped queries, her own renewals |
| `tom.okafor@arclight.systems` | Viewer | Whole portfolio, read-only |

Sign in as Sofia to see row-level scoping: her run-rate, seat counts, renewals and
budgets are the Sales cost centre's, not the company's.

---

## What it does

| Module | The question it answers |
|---|---|
| **Overview** | What is the run-rate, where is it going, and what needs a decision this week? |
| **Vendors** | Who owns each application, what does it cost, how much of it is used, when does it renew? |
| **Spend & invoices** | The invoice ledger behind every figure — committed spend, overage and credits per vendor per period. |
| **Seats & licences** | Which seats have been idle 30+ days, which belong to offboarded staff, and what does reclaiming them save? |
| **Overages & commitments** | Where have seat counts drifted past the contract, and where are we paying for commitment nobody uses? |
| **Renewals** | What rolls automatically, when does the notice window close, who owns the negotiation, and what is the target? |
| **Budgets & chargeback** | What does each cost centre consume against its budget, and which vendors make up that bill? |
| **Shadow IT** | What is reaching company data without going through procurement, how risky, and does it duplicate something we already buy? |
| **Users & roles** | Which capabilities each role carries, and who holds which role. |
| **Audit log** | Every sign-in, failed attempt and data change, with actor and source address. |

Each optimisation module quantifies its own lever, and the overview totals them:
dormant-seat reclamation, renewal negotiation targets, duplicate tooling, and
shelfware on over-commitment.

---

## Architecture

```
src/
  app/
    (auth)/login/        sign-in page + auth server actions
    (app)/               authenticated shell: every product page
      actions.ts         all mutations, each guarded by CSRF + capability + audit
    api/export/vendors/  CSV export (capability-gated, formula-injection safe)
  components/            UI primitives, charts, forms
  db/
    schema.ts            Drizzle schema — the single source of truth
    catalog.ts           the fictional company the demo seed builds
    seed.mts             deterministic seeder
  lib/
    auth.ts              sessions, CSRF, origin checks
    password.ts          scrypt hashing + constant-time verification
    rbac.ts              capabilities, roles, department scoping
    queries.ts           every read the product performs
    rate-limit.ts        database-backed fixed-window limiter
    audit.ts             append-only activity trail
```

**Stack.** Next.js 16 (App Router, React Server Components), TypeScript in strict
mode, Tailwind v4, Drizzle ORM on SQLite via better-sqlite3. No client-side data
fetching: pages are server components that query directly, and mutations are server
actions. Migrations live in `drizzle/` and run automatically on first connection.

**Postgres.** Every query is written against Drizzle's dialect-neutral builder, so
moving to Postgres is a driver swap in `src/db/index.ts` plus a regenerated
migration. Money is stored as integer cents throughout — no float ever touches a
currency value.

---

## Security

| Concern | How it is handled |
|---|---|
| Password storage | scrypt, N=2¹⁷ r=8 p=1, per-password salt, constant-time comparison |
| Account enumeration | Identical error text and comparable timing whether the account is missing, disabled or locked |
| Brute force | Per-IP and per-email fixed-window rate limits, plus a 15-minute lockout after five consecutive failures |
| Sessions | 32 bytes of CSPRNG entropy; only the SHA-256 hash is stored; `HttpOnly`, `SameSite=Lax`, `Secure` in production; 12-hour expiry that slides at most hourly |
| CSRF | Double-submit token bound to the session by HMAC, plus an `Origin`/`Host` check on every mutation. The token cookie is `HttpOnly` — forms receive the token from a server component, so no client script ever needs to read it |
| Authorisation | Capability-based. Pages and actions ask `can(user, "seat.reclaim")`, never for a role name. Every mutation re-checks server-side and re-verifies that the target row belongs to the caller's tenant and department |
| Tenant isolation | `orgId` is bound into every query; department owners additionally get a `departmentId` predicate |
| Input validation | Zod schemas on every server action; unknown fields rejected, numbers bounded |
| SQL injection | Parameterised throughout — Drizzle's `sql` tagged template, no string concatenation |
| XSS | React escaping; a strict CSP (`frame-ancestors 'none'`, `object-src 'none'`, no remote origins) set in `next.config.ts` |
| CSV injection | Leading `=`, `+`, `-`, `@` neutralised before quoting in the export |
| Privilege lockout | The last active administrator cannot be demoted or disabled |
| Error surface | Server actions return fixed messages; unexpected failures are logged server-side rather than echoed to the client |
| Auditability | Sign-ins, failures, rate-limit trips, exports and every data change are appended to `audit_log` with actor, entity and IP |

`SIGHTLINE_SECRET` (32+ characters) signs CSRF tokens. Production refuses to start
without it; development falls back to a fixed value so a fresh clone runs.

---

## Data visualisation

Charts are hand-built SVG — no charting dependency — and follow one discipline:

- A validated categorical palette assigned in fixed slot order, never cycled, with
  a dark-mode set stepped for the dark surface rather than flipped.
- One y-axis per chart, ticks rounded to clean numbers that always extend past the
  largest value.
- Thin marks (≤24px bars, 2px lines), 4px rounded data-ends, a 2px surface gap
  between stacked segments, hairline recessive gridlines.
- Every chart carries a hover layer *and* a table view, so no value is reachable
  only by pointing at it. Status colours always ship with a glyph, never colour alone.
- Axis label density is computed from the rendered width, so ticks never collide.

---

## Notes

- Arclight Systems, its employees, invoices and vendor terms are fictional. Vendor
  names are real products a company of this shape would actually buy; the numbers
  attached to them are invented.
- `data/` is git-ignored. The database is rebuilt by `npm run seed`.
- `npm run typecheck` and `npm run build` both run clean.

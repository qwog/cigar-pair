import type { ReactNode } from "react";
import { Sparkline } from "@/components/charts";
import { signedPercent } from "@/lib/format";

export type Tone = "neutral" | "accent" | "good" | "warning" | "serious" | "critical";

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

const ICON: Record<Tone, string> = {
  neutral: "•",
  accent: "•",
  good: "✓",
  warning: "!",
  serious: "!",
  critical: "✕",
};

/** Status never rides on colour alone — every status badge carries a glyph. */
export function StatusBadge({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className={`badge badge-${tone}`}>
      <span aria-hidden>{ICON[tone]}</span>
      {label}
    </span>
  );
}

export function Card({
  children,
  className = "",
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  return <Tag className={`card ${className}`}>{children}</Tag>;
}

export function CardHead({
  title,
  sub,
  action,
}: {
  title: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="card-head">
      <div className="min-w-0">
        <h2 className="card-title">{title}</h2>
        {sub ? <p className="card-sub">{sub}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function StatTile({
  label,
  value,
  delta,
  deltaLabel,
  deltaGoodWhen = "down",
  hint,
  spark,
  sparkColor,
  tone,
  href,
}: {
  label: string;
  value: string;
  delta?: number;
  deltaLabel?: string;
  deltaGoodWhen?: "up" | "down" | "none";
  hint?: ReactNode;
  spark?: number[];
  sparkColor?: string;
  tone?: Tone;
  href?: string;
}) {
  const good =
    delta === undefined || deltaGoodWhen === "none"
      ? null
      : deltaGoodWhen === "up"
        ? delta >= 0
        : delta <= 0;
  const deltaColor = good === null ? "var(--ink-2)" : good ? "var(--good-ink)" : "var(--critical-ink)";

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-medium" style={{ color: "var(--ink-3)" }}>
          {label}
        </p>
        {tone ? <span className={`badge badge-${tone}`}>{tone === "critical" ? "Action" : "Watch"}</span> : null}
      </div>
      <p className="mt-2 text-[28px] font-semibold leading-none tracking-[-0.02em]" style={{ color: "var(--ink)" }}>
        {value}
      </p>
      <div className="mt-2.5 flex items-end justify-between gap-2">
        <p className="text-[12px]" style={{ color: "var(--ink-3)" }}>
          {delta !== undefined ? (
            <span className="num font-semibold" style={{ color: deltaColor }}>
              {good !== null ? (delta >= 0 ? "▲ " : "▼ ") : ""}
              {signedPercent(delta)}
            </span>
          ) : null}
          {delta !== undefined && deltaLabel ? " " : null}
          {deltaLabel}
          {delta === undefined ? hint : null}
        </p>
        {spark && spark.length > 1 ? <Sparkline values={spark} color={sparkColor ?? "var(--series-1)"} /> : null}
      </div>
      {delta !== undefined && hint ? (
        <p className="mt-1 text-[12px]" style={{ color: "var(--ink-3)" }}>
          {hint}
        </p>
      ) : null}
    </>
  );

  if (href) {
    return (
      <a href={href} className="card card-pad block transition-colors hover:border-[var(--line-2)]">
        {body}
      </a>
    );
  }
  return <div className="card card-pad">{body}</div>;
}

export function Meter({ ratio, tone = "accent" }: { ratio: number; tone?: Tone }) {
  const color =
    tone === "critical"
      ? "var(--critical)"
      : tone === "serious"
        ? "var(--serious)"
        : tone === "warning"
          ? "var(--warning)"
          : tone === "good"
            ? "var(--good)"
            : "var(--accent)";
  return (
    <div className="meter" role="presentation">
      <span style={{ width: `${Math.min(100, Math.max(1.5, ratio * 100))}%`, background: color }} />
    </div>
  );
}

export function VendorMark({ name, hue, size = 28 }: { name: string; hue: number; size?: number }) {
  const letters = name
    .replace(/[^A-Za-z0-9 ]/g, "")
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-[7px] font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        color: "#fff",
        background: `var(--series-${(hue % 8) + 1})`,
      }}
    >
      {letters}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  sub,
  actions,
}: {
  eyebrow?: string;
  title: string;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-1.5">{eyebrow}</p> : null}
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]" style={{ color: "var(--ink)" }}>
          {title}
        </h1>
        {sub ? (
          <p className="mt-1 max-w-3xl text-[13px]" style={{ color: "var(--ink-2)" }}>
            {sub}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
        {title}
      </p>
      {body ? (
        <p className="mx-auto mt-1.5 max-w-md text-[13px]" style={{ color: "var(--ink-3)" }}>
          {body}
        </p>
      ) : null}
    </div>
  );
}

export function riskTone(risk: string): Tone {
  return risk === "high" ? "critical" : risk === "medium" ? "warning" : "neutral";
}

export function utilizationTone(ratio: number): Tone {
  if (ratio >= 0.8) return "good";
  if (ratio >= 0.6) return "warning";
  return "critical";
}

export function renewalTone(days: number): Tone {
  if (days <= 30) return "critical";
  if (days <= 90) return "serious";
  return "neutral";
}

export function AccessDenied({ what }: { what: string }) {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <p className="eyebrow">Access denied</p>
      <h1 className="mt-2 text-[22px] font-semibold tracking-[-0.02em]" style={{ color: "var(--ink)" }}>
        Your role cannot open {what}
      </h1>
      <p className="mt-2 text-[13px]" style={{ color: "var(--ink-2)" }}>
        Ask a Sightline administrator to grant the capability you need. Nothing about this page has been disclosed.
      </p>
      <a href="/dashboard" className="btn btn-primary mt-5">
        Back to overview
      </a>
    </div>
  );
}

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const USD_CENTS = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const money = (cents: number) => USD.format(Math.round(cents) / 100);
export const moneyExact = (cents: number) => USD_CENTS.format(cents / 100);

/** 1,284 / 12.9K / $4.2M — the stat-tile contract's auto-compact value. */
export function compactMoney(cents: number): string {
  const dollars = Math.round(cents) / 100;
  const abs = Math.abs(dollars);
  const sign = dollars < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${trim(abs / 1_000_000)}M`;
  if (abs >= 10_000) return `${sign}$${trim(abs / 1_000)}K`;
  return USD.format(dollars);
}

export function compactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (abs >= 10_000) return `${trim(value / 1_000)}K`;
  return value.toLocaleString("en-US");
}

const trim = (value: number) => {
  const abs = Math.abs(value);
  const rounded =
    abs >= 100 ? Math.round(value) : abs >= 10 ? Math.round(value * 10) / 10 : Math.round(value * 100) / 100;
  return rounded.toLocaleString("en-US", { maximumFractionDigits: 2 });
};

export const percent = (ratio: number, digits = 0) =>
  `${(ratio * 100).toFixed(digits)}%`;

export const signedPercent = (ratio: number, digits = 1) =>
  `${ratio >= 0 ? "+" : ""}${(ratio * 100).toFixed(digits)}%`;

export function monthLabel(periodMonth: string, style: "short" | "long" = "short"): string {
  const [y, m] = periodMonth.split("-").map(Number);
  const date = new Date(Date.UTC(y!, (m ?? 1) - 1, 1));
  return date.toLocaleDateString("en-US", {
    month: style,
    year: style === "long" ? "numeric" : "2-digit",
    timeZone: "UTC",
  });
}

export function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function dateTimeLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function daysUntil(iso: string, from: Date = new Date()): number {
  const target = Date.parse(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  const base = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  return Math.round((target - base) / 86_400_000);
}

export function relativeDays(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days < 45) return `in ${days}d`;
  return `in ${Math.round(days / 30)}mo`;
}

/** Rolling window of `count` months ending at (and including) `end`. */
export function monthRange(count: number, end: Date = new Date()): string[] {
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - i, 1));
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

export function addMonths(periodMonth: string, delta: number): string {
  const [y, m] = periodMonth.split("-").map(Number);
  const d = new Date(Date.UTC(y!, (m ?? 1) - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

"use client";
import { compactMoney, compactNumber, money, moneyExact, percent } from "@/lib/format";

export type ValueFormat = "money" | "moneyExact" | "compactMoney" | "number" | "percent" | "seats";

export function formatValue(value: number, format: ValueFormat): string {
  switch (format) {
    case "money":
      return money(value);
    case "moneyExact":
      return moneyExact(value);
    case "compactMoney":
      return compactMoney(value);
    case "percent":
      return percent(value, 0);
    case "seats":
      return `${compactNumber(value)} seats`;
    default:
      return compactNumber(value);
  }
}

/** Axis ticks round to clean numbers so the reader never parses 4,371.83. */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const rough = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? magnitude * 10;
  const ticks: number[] = [0];
  // Always extend past the largest value, so no mark is drawn outside the plot.
  while (ticks[ticks.length - 1]! < max) ticks.push(+(ticks[ticks.length - 1]! + step).toPrecision(12));
  return ticks;
}

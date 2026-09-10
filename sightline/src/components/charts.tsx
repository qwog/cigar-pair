"use client";

import { useId, useMemo, useState } from "react";
import { useSize } from "@/components/use-size";
import { formatValue, niceTicks, type ValueFormat } from "@/components/format-client";
import { monthLabel } from "@/lib/format";


const PAD = { top: 14, right: 14, bottom: 28, left: 56 };

type Tip = { x: number; index: number } | null;

function Tooltip({ x, width, children }: { x: number; width: number; children: React.ReactNode }) {
  const clamped = Math.min(Math.max(x, 96), Math.max(width - 96, 96));
  return (
    <div
      className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-lg px-3 py-2 text-[12px] leading-5"
      style={{
        left: clamped,
        background: "var(--surface)",
        border: "1px solid var(--line-2)",
        boxShadow: "var(--shadow-pop)",
        minWidth: 150,
      }}
    >
      {children}
    </div>
  );
}

function TipRow({ color, label, value }: { color?: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-2" style={{ color: "var(--ink-2)" }}>
        {color ? (
          <span
            aria-hidden
            style={{ width: 8, height: 8, borderRadius: 2, background: color, display: "inline-block" }}
          />
        ) : null}
        {label}
      </span>
      <span className="num font-semibold" style={{ color: "var(--ink)" }}>
        {value}
      </span>
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2 text-[12px]" style={{ color: "var(--ink-2)" }}>
          <span
            aria-hidden
            style={{ width: 10, height: 10, borderRadius: 3, background: item.color, display: "inline-block" }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/** The WCAG-clean twin every chart ships with. */
export function TableView({
  columns,
  rows,
  label = "table view",
}: {
  columns: string[];
  rows: (string | number)[][];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="px-1">
      <button
        type="button"
        className="btn btn-ghost btn-sm mt-2 !px-1"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Hide" : "Show"} {label}
      </button>
      {open ? (
        <div className="tbl-scroll thin-scroll mt-2 max-h-72 overflow-y-auto rounded-lg border" style={{ borderColor: "var(--line)" }}>
          <table className="tbl">
            <thead>
              <tr>
                {columns.map((column, i) => (
                  <th key={column} className={i === 0 ? "" : "r"}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className={j === 0 ? "" : "r num"}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ stacked columns

export type StackSeries = { key: string; label: string; color: string };

export function StackedColumns({
  months,
  series,
  data,
  height = 232,
  format = "compactMoney",
  tableLabel = "monthly figures",
}: {
  months: string[];
  series: StackSeries[];
  data: Record<string, number>[];
  height?: number;
  format?: ValueFormat;
  tableLabel?: string;
}) {
  const { ref, width } = useSize<HTMLDivElement>();
  const [tip, setTip] = useState<Tip>(null);
  const clipId = useId();

  const totals = data.map((row) => series.reduce((sum, s) => sum + (row[s.key] ?? 0), 0));
  const max = Math.max(1, ...totals);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1]!;

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const band = months.length ? plotW / months.length : 0;
  const barW = Math.min(24, band * 0.6);
  const yOf = (value: number) => PAD.top + plotH - (value / top) * plotH;

  const labelEvery = Math.max(1, Math.ceil(44 / Math.max(band, 1)));

  return (
    <div>
      <div ref={ref} className="relative w-full">
        {width > 0 ? (
          <svg width={width} height={height} role="img" aria-label={`Stacked column chart, ${tableLabel}`}>
            <defs>
              <clipPath id={clipId}>
                <rect x={PAD.left} y={0} width={plotW} height={height} />
              </clipPath>
            </defs>
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={yOf(tick)}
                  y2={yOf(tick)}
                  stroke={tick === 0 ? "var(--axis)" : "var(--grid)"}
                  strokeWidth="1"
                  shapeRendering="crispEdges"
                />
                <text
                  x={PAD.left - 10}
                  y={yOf(tick) + 4}
                  textAnchor="end"
                  className="num"
                  fontSize="11"
                  fill="var(--ink-3)"
                >
                  {formatValue(tick, format)}
                </text>
              </g>
            ))}

            <g clipPath={`url(#${clipId})`}>
              {data.map((row, i) => {
                const cx = PAD.left + band * i + band / 2;
                let cursor = 0;
                return (
                  <g key={months[i]} opacity={tip && tip.index !== i ? 0.45 : 1}>
                    {series.map((s, si) => {
                      const value = row[s.key] ?? 0;
                      if (value <= 0) return null;
                      const y0 = yOf(cursor);
                      cursor += value;
                      const y1 = yOf(cursor);
                      // 2px surface gap between touching segments; only the top
                      // segment gets the 4px rounded data-end.
                      const gap = si === 0 ? 0 : 2;
                      const h = Math.max(0, y0 - y1 - gap);
                      const isTop = si === series.length - 1;
                      const r = isTop ? Math.min(4, h / 2, barW / 2) : 0;
                      return (
                        <path
                          key={s.key}
                          d={`M${cx - barW / 2},${y1 + h} v${-(h - r)} a${r},${r} 0 0 1 ${r},${-r} h${barW - r * 2} a${r},${r} 0 0 1 ${r},${r} v${h - r} z`}
                          fill={s.color}
                        />
                      );
                    })}
                  </g>
                );
              })}
            </g>

            {months.map((month, i) =>
              (months.length - 1 - i) % labelEvery === 0 ? (
                <text
                  key={month}
                  x={PAD.left + band * i + band / 2}
                  y={height - 9}
                  textAnchor={i === 0 ? "start" : i === months.length - 1 ? "end" : "middle"}
                  fontSize="11"
                  fill="var(--ink-3)"
                >
                  {monthLabel(month)}
                </text>
              ) : null,
            )}

            {months.map((month, i) => (
              <rect
                key={`hit-${month}`}
                x={PAD.left + band * i}
                y={PAD.top}
                width={band}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setTip({ index: i, x: PAD.left + band * i + band / 2 })}
                onMouseLeave={() => setTip(null)}
              />
            ))}
          </svg>
        ) : (
          <div style={{ height }} />
        )}

        {tip ? (
          <Tooltip x={tip.x} width={width}>
            <div className="mb-1.5 font-semibold" style={{ color: "var(--ink)" }}>
              {monthLabel(months[tip.index]!, "long")}
            </div>
            {series.map((s) => (
              <TipRow
                key={s.key}
                color={s.color}
                label={s.label}
                value={formatValue(data[tip.index]?.[s.key] ?? 0, format)}
              />
            ))}
            <div className="mt-1.5 border-t pt-1.5" style={{ borderColor: "var(--line)" }}>
              <TipRow label="Total" value={formatValue(totals[tip.index] ?? 0, format)} />
            </div>
          </Tooltip>
        ) : null}
      </div>

      {series.length > 1 ? <Legend items={series.map((s) => ({ label: s.label, color: s.color }))} /> : null}
      <TableView
        label={tableLabel}
        columns={["Month", ...series.map((s) => s.label), "Total"]}
        rows={months.map((month, i) => [
          monthLabel(month, "long"),
          ...series.map((s) => formatValue(data[i]?.[s.key] ?? 0, format)),
          formatValue(totals[i] ?? 0, format),
        ])}
      />
    </div>
  );
}

// ------------------------------------------------------------------ line chart

export type LineSeries = { key: string; label: string; color: string; values: number[] };

export function LineChart({
  months,
  series,
  height = 232,
  format = "number",
  tableLabel = "monthly figures",
  zeroBased = true,
}: {
  months: string[];
  series: LineSeries[];
  height?: number;
  format?: ValueFormat;
  tableLabel?: string;
  zeroBased?: boolean;
}) {
  const { ref, width } = useSize<HTMLDivElement>();
  const [tip, setTip] = useState<Tip>(null);

  const all = series.flatMap((s) => s.values);
  const rawMax = Math.max(1, ...all);
  const ticks = niceTicks(rawMax);
  const top = ticks[ticks.length - 1]!;
  const floor = zeroBased ? 0 : Math.min(...all) * 0.95;

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const step = months.length > 1 ? plotW / (months.length - 1) : 0;
  const xOf = (i: number) => PAD.left + step * i;
  const yOf = (value: number) => PAD.top + plotH - ((value - floor) / (top - floor)) * plotH;
  // Label density follows the rendered width, so ticks never collide.
  const labelEvery = Math.max(1, Math.ceil(48 / Math.max(step, 1)));
  const single = series.length === 1;

  return (
    <div>
      <div ref={ref} className="relative w-full">
        {width > 0 ? (
          <svg width={width} height={height} role="img" aria-label={`Line chart, ${tableLabel}`}>
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={yOf(tick)}
                  y2={yOf(tick)}
                  stroke={tick === 0 ? "var(--axis)" : "var(--grid)"}
                  strokeWidth="1"
                  shapeRendering="crispEdges"
                />
                <text x={PAD.left - 10} y={yOf(tick) + 4} textAnchor="end" className="num" fontSize="11" fill="var(--ink-3)">
                  {formatValue(tick, format)}
                </text>
              </g>
            ))}

            {tip ? (
              <line
                x1={xOf(tip.index)}
                x2={xOf(tip.index)}
                y1={PAD.top}
                y2={PAD.top + plotH}
                stroke="var(--axis)"
                strokeWidth="1"
              />
            ) : null}

            {series.map((s) => {
              const line = s.values.map((v, i) => `${i === 0 ? "M" : "L"}${xOf(i)},${yOf(v)}`).join(" ");
              const area = `${line} L${xOf(s.values.length - 1)},${yOf(floor)} L${xOf(0)},${yOf(floor)} Z`;
              return (
                <g key={s.key}>
                  {single ? <path d={area} fill={s.color} opacity={0.1} /> : null}
                  <path d={line} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                  <circle
                    cx={xOf(s.values.length - 1)}
                    cy={yOf(s.values[s.values.length - 1] ?? 0)}
                    r="4"
                    fill={s.color}
                    stroke="var(--surface)"
                    strokeWidth="2"
                  />
                  {tip ? (
                    <circle
                      cx={xOf(tip.index)}
                      cy={yOf(s.values[tip.index] ?? 0)}
                      r="4.5"
                      fill={s.color}
                      stroke="var(--surface)"
                      strokeWidth="2"
                    />
                  ) : null}
                </g>
              );
            })}

            {months.map((month, i) =>
              (months.length - 1 - i) % labelEvery === 0 ? (
                <text
                  key={month}
                  x={xOf(i)}
                  y={height - 9}
                  textAnchor={i === 0 ? "start" : i === months.length - 1 ? "end" : "middle"}
                  fontSize="11"
                  fill="var(--ink-3)"
                >
                  {monthLabel(month)}
                </text>
              ) : null,
            )}

            {months.map((month, i) => (
              <rect
                key={`hit-${month}`}
                x={xOf(i) - step / 2}
                y={PAD.top}
                width={Math.max(step, 24)}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setTip({ index: i, x: xOf(i) })}
                onMouseLeave={() => setTip(null)}
              />
            ))}
          </svg>
        ) : (
          <div style={{ height }} />
        )}

        {tip ? (
          <Tooltip x={tip.x} width={width}>
            <div className="mb-1.5 font-semibold" style={{ color: "var(--ink)" }}>
              {monthLabel(months[tip.index]!, "long")}
            </div>
            {series.map((s) => (
              <TipRow key={s.key} color={s.color} label={s.label} value={formatValue(s.values[tip.index] ?? 0, format)} />
            ))}
          </Tooltip>
        ) : null}
      </div>

      {series.length > 1 ? <Legend items={series.map((s) => ({ label: s.label, color: s.color }))} /> : null}
      <TableView
        label={tableLabel}
        columns={["Month", ...series.map((s) => s.label)]}
        rows={months.map((month, i) => [monthLabel(month, "long"), ...series.map((s) => formatValue(s.values[i] ?? 0, format))])}
      />
    </div>
  );
}

// ------------------------------------------------------------------ bar list

export function BarList({
  items,
  format = "compactMoney",
  tableLabel = "values",
  valueLabel = "Spend",
  max: maxOverride,
}: {
  items: { label: string; value: number; hint?: string; color?: string }[];
  format?: ValueFormat;
  tableLabel?: string;
  valueLabel?: string;
  max?: number;
}) {
  const max = Math.max(1, maxOverride ?? Math.max(...items.map((item) => item.value), 1));
  return (
    <div>
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item.label} className="group">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[13px]" style={{ color: "var(--ink)" }} title={item.label}>
                {item.label}
              </span>
              <span className="num shrink-0 text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
                {formatValue(item.value, format)}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(1.5, (item.value / max) * 100)}%`,
                    background: item.color ?? "var(--series-1)",
                  }}
                />
              </div>
              {item.hint ? (
                <span className="num shrink-0 text-[11px]" style={{ color: "var(--ink-3)" }}>
                  {item.hint}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <TableView
        label={tableLabel}
        columns={["Name", valueLabel]}
        rows={items.map((item) => [item.label, formatValue(item.value, format)])}
      />
    </div>
  );
}

// ------------------------------------------------------------------ sparkline

export function Sparkline({
  values,
  width = 108,
  height = 30,
  color = "var(--series-1)",
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => (i / (values.length - 1)) * (width - 4) + 2;
  const y = (v: number) => height - 3 - ((v - min) / span) * (height - 8);
  const path = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} aria-hidden focusable="false" style={{ display: "block" }}>
      <path d={`${path} L${x(values.length - 1)},${height} L${x(0)},${height} Z`} fill={color} opacity="0.1" />
      <path d={path} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1]!)} r="2.75" fill={color} stroke="var(--surface)" strokeWidth="1.5" />
    </svg>
  );
}

// ------------------------------------------------------------------ renewal runway

export function RunwayChart({
  buckets,
  height = 200,
}: {
  buckets: { month: string; cents: number; count: number }[];
  height?: number;
}) {
  const { ref, width } = useSize<HTMLDivElement>();
  const [tip, setTip] = useState<Tip>(null);
  const max = Math.max(1, ...buckets.map((b) => b.cents));
  const ticks = niceTicks(max, 3);
  const top = ticks[ticks.length - 1]!;
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const band = buckets.length ? plotW / buckets.length : 0;
  const barW = Math.min(24, band * 0.58);
  const yOf = (value: number) => PAD.top + plotH - (value / top) * plotH;

  return (
    <div>
      <div ref={ref} className="relative w-full">
        {width > 0 ? (
          <svg width={width} height={height} role="img" aria-label="Contract value coming up for renewal by month">
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={yOf(tick)}
                  y2={yOf(tick)}
                  stroke={tick === 0 ? "var(--axis)" : "var(--grid)"}
                  strokeWidth="1"
                  shapeRendering="crispEdges"
                />
                <text x={PAD.left - 10} y={yOf(tick) + 4} textAnchor="end" className="num" fontSize="11" fill="var(--ink-3)">
                  {formatValue(tick, "compactMoney")}
                </text>
              </g>
            ))}
            {buckets.map((bucket, i) => {
              const h = Math.max(0, yOf(0) - yOf(bucket.cents));
              const r = Math.min(4, h / 2, barW / 2);
              const cx = PAD.left + band * i + band / 2;
              // First two months are inside the typical notice window.
              const color = i < 2 ? "var(--critical)" : i < 4 ? "var(--serious)" : "var(--series-1)";
              return (
                <g key={bucket.month} opacity={tip && tip.index !== i ? 0.45 : 1}>
                  <path
                    d={`M${cx - barW / 2},${yOf(0)} v${-(h - r)} a${r},${r} 0 0 1 ${r},${-r} h${barW - r * 2} a${r},${r} 0 0 1 ${r},${r} v${h - r} z`}
                    fill={color}
                  />
                </g>
              );
            })}
            {buckets.map((bucket, i) =>
              i % Math.max(1, Math.ceil(30 / Math.max(band, 1))) === 0 ? (
              <text
                key={`lbl-${bucket.month}`}
                x={PAD.left + band * i + band / 2}
                y={height - 9}
                textAnchor="middle"
                fontSize="11"
                fill="var(--ink-3)"
              >
                {monthLabel(bucket.month)}
              </text>
              ) : null,
            )}
            {buckets.map((bucket, i) => (
              <rect
                key={`hit-${bucket.month}`}
                x={PAD.left + band * i}
                y={PAD.top}
                width={band}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setTip({ index: i, x: PAD.left + band * i + band / 2 })}
                onMouseLeave={() => setTip(null)}
              />
            ))}
          </svg>
        ) : (
          <div style={{ height }} />
        )}
        {tip ? (
          <Tooltip x={tip.x} width={width}>
            <div className="mb-1.5 font-semibold" style={{ color: "var(--ink)" }}>
              {monthLabel(buckets[tip.index]!.month, "long")}
            </div>
            <TipRow label="Contract value" value={formatValue(buckets[tip.index]!.cents, "money")} />
            <TipRow label="Contracts" value={String(buckets[tip.index]!.count)} />
          </Tooltip>
        ) : null}
      </div>
      <Legend
        items={[
          { label: "Inside notice window", color: "var(--critical)" },
          { label: "Next quarter", color: "var(--serious)" },
          { label: "Later", color: "var(--series-1)" },
        ]}
      />
      <TableView
        label="renewal schedule"
        columns={["Month", "Contracts", "Contract value"]}
        rows={buckets.map((b) => [monthLabel(b.month, "long"), b.count, formatValue(b.cents, "money")])}
      />
    </div>
  );
}

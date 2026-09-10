"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { reclaimSeats, type ActionState } from "@/app/(app)/actions";
import { VendorMark } from "@/components/ui";
import { dateLabel, money, moneyExact } from "@/lib/format";
import type { SeatRow } from "@/lib/queries";

function Submit({ count, savings }: { count: number; savings: number }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary btn-sm" disabled={pending || count === 0}>
      {pending
        ? "Reclaiming…"
        : count === 0
          ? "Select seats to reclaim"
          : `Reclaim ${count} seat${count === 1 ? "" : "s"} · ${money(savings)}/yr`}
    </button>
  );
}

export function SeatReclaimTable({
  rows,
  csrf,
  canReclaim,
}: {
  rows: SeatRow[];
  csrf: string;
  canReclaim: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, action] = useActionState<ActionState, FormData>(reclaimSeats, {});

  const savings = useMemo(
    () => rows.filter((row) => selected.has(row.id)).reduce((sum, row) => sum + row.monthlyCostCents * 12, 0),
    [rows, selected],
  );

  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={action}>
      <input type="hidden" name="csrf" value={csrf} />

      {canReclaim ? (
        <div
          className="flex flex-wrap items-center gap-3 px-5 py-3"
          style={{ borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", background: "var(--surface-2)" }}
        >
          <Submit count={selected.size} savings={savings} />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setSelected(allSelected ? new Set() : new Set(rows.map((row) => row.id)))}
          >
            {allSelected ? "Clear selection" : `Select all ${rows.length}`}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() =>
              setSelected(new Set(rows.filter((row) => row.employeeStatus === "offboarded").map((row) => row.id)))
            }
          >
            Select offboarded only
          </button>
          {state.ok ? (
            <p role="status" className="text-[12px] font-semibold" style={{ color: "var(--good-ink)" }}>
              {state.ok}
            </p>
          ) : null}
          {state.error ? (
            <p role="alert" className="text-[12px] font-semibold" style={{ color: "var(--critical-ink)" }}>
              {state.error}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="tbl-scroll thin-scroll">
        <table className="tbl">
          <thead>
            <tr>
              {canReclaim ? (
                <th style={{ width: 34 }}>
                  <span className="sr-only">Select</span>
                </th>
              ) : null}
              <th>Person</th>
              <th>Vendor</th>
              <th>Department</th>
              <th>Tier</th>
              <th className="r">Idle</th>
              <th>Last active</th>
              <th className="r">Cost / yr</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const checked = selected.has(row.id);
              return (
                <tr key={row.id} style={checked ? { background: "var(--accent-soft)" } : undefined}>
                  {canReclaim ? (
                    <td>
                      <input
                        type="checkbox"
                        name="seatId"
                        value={row.id}
                        checked={checked}
                        onChange={() => toggle(row.id)}
                        aria-label={`Reclaim ${row.vendorName} seat for ${row.employeeName}`}
                        style={{ accentColor: "var(--accent)", width: 15, height: 15 }}
                      />
                    </td>
                  ) : null}
                  <td>
                    <span className="block font-medium" style={{ color: "var(--ink)" }}>
                      {row.employeeName}
                      {row.employeeStatus === "offboarded" ? (
                        <span className="badge badge-critical ml-2">
                          <span aria-hidden>✕</span> offboarded
                        </span>
                      ) : null}
                    </span>
                    <span className="block text-[11px]" style={{ color: "var(--ink-3)" }}>
                      {row.employeeEmail} · {row.title}
                    </span>
                  </td>
                  <td>
                    <span className="flex items-center gap-2">
                      <VendorMark name={row.vendorName} hue={row.accentHue} size={22} />
                      {row.vendorName}
                    </span>
                  </td>
                  <td style={{ color: "var(--ink-2)" }}>{row.department}</td>
                  <td style={{ color: "var(--ink-2)" }}>{row.tier}</td>
                  <td className="r num" style={{ color: (row.idleDays ?? 0) > 90 ? "var(--critical-ink)" : "var(--ink-2)" }}>
                    {row.idleDays !== null ? `${row.idleDays}d` : "never"}
                  </td>
                  <td className="num" style={{ color: "var(--ink-3)" }}>
                    {row.lastActiveAt ? dateLabel(row.lastActiveAt) : "No recorded sign-in"}
                  </td>
                  <td className="r num font-semibold">{moneyExact(row.monthlyCostCents * 12)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </form>
  );
}

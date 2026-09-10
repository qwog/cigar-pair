import type { ReactNode } from "react";

/** One filter row above everything it scopes — a plain GET form, no client JS. */
export function FilterBar({
  action,
  children,
  hint,
}: {
  action: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <form
      method="get"
      action={action}
      className="card mb-4 flex flex-wrap items-end gap-3 px-4 py-3"
    >
      {children}
      <button type="submit" className="btn btn-sm">
        Apply
      </button>
      <a href={action} className="btn btn-ghost btn-sm">
        Reset
      </a>
      {hint ? (
        <span className="ml-auto text-[12px]" style={{ color: "var(--ink-3)" }}>
          {hint}
        </span>
      ) : null}
    </form>
  );
}

export function Field({
  label,
  name,
  children,
  width = 170,
}: {
  label: string;
  name: string;
  children: ReactNode;
  width?: number;
}) {
  return (
    <label className="block" style={{ width }}>
      <span className="label mb-1 text-[11px]">{label}</span>
      {children}
      <span className="sr-only">{name}</span>
    </label>
  );
}

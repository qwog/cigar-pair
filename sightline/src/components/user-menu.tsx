"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/(auth)/login/actions";
import { initials } from "@/lib/format";

export function UserMenu({
  name,
  email,
  role,
  department,
}: {
  name: string;
  email: string;
  role: string;
  department: string | null;
}) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrapper}>
      <button
        type="button"
        className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-[var(--surface-2)]"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span
          aria-hidden
          className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        >
          {initials(name)}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-[12px] font-semibold leading-tight" style={{ color: "var(--ink)" }}>
            {name}
          </span>
          <span className="block text-[11px] leading-tight" style={{ color: "var(--ink-3)" }}>
            {role}
          </span>
        </span>
        <span aria-hidden style={{ color: "var(--ink-3)", fontSize: 10 }}>
          ▾
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-[248px] rounded-xl p-1.5"
          style={{ background: "var(--surface)", border: "1px solid var(--line-2)", boxShadow: "var(--shadow-pop)" }}
        >
          <div className="px-2.5 py-2">
            <p className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
              {name}
            </p>
            <p className="truncate text-[12px]" style={{ color: "var(--ink-3)" }}>
              {email}
            </p>
            <p className="mt-1.5 text-[11px]" style={{ color: "var(--ink-3)" }}>
              {role}
              {department ? ` · ${department}` : ""}
            </p>
          </div>
          <div className="my-1 h-px" style={{ background: "var(--line)" }} />
          <form action={signOut}>
            <button
              type="submit"
              role="menuitem"
              className="w-full rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-[var(--surface-2)]"
              style={{ color: "var(--ink)" }}
            >
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

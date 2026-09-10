"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Wordmark } from "@/components/logo";

export type NavItem = { href: string; label: string; badge?: string; group: string };

export function SidebarNav({ items, org }: { items: NavItem[]; org: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const groups = items.reduce<Record<string, NavItem[]>>((acc, item) => {
    (acc[item.group] ??= []).push(item);
    return acc;
  }, {});

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost btn-sm fixed left-3 top-3 z-40 lg:hidden"
        aria-expanded={open}
        aria-controls="sl-sidebar"
        onClick={() => setOpen((value) => !value)}
        style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
      >
        <span aria-hidden>{open ? "✕" : "☰"}</span>
        <span className="sr-only">Menu</span>
      </button>

      {open ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 lg:hidden"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        id="sl-sidebar"
        className={`fixed inset-y-0 left-0 z-30 flex w-[248px] flex-col transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "var(--rail)", borderRight: "1px solid var(--line)" }}
      >
        <div className="flex h-[60px] shrink-0 items-center px-5" style={{ borderBottom: "1px solid var(--line)" }}>
          <Link href="/dashboard" onClick={() => setOpen(false)}>
            <Wordmark />
          </Link>
        </div>

        <nav className="thin-scroll flex-1 overflow-y-auto px-3 py-4" aria-label="Primary">
          {Object.entries(groups).map(([group, groupItems]) => (
            <div key={group} className="mb-5">
              <p className="eyebrow mb-2 px-2">{group}</p>
              <ul className="space-y-0.5">
                {groupItems.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-colors"
                        style={
                          active
                            ? { background: "var(--accent-soft)", color: "var(--accent)" }
                            : { color: "var(--ink-2)" }
                        }
                      >
                        <span className="flex items-center gap-2.5">
                          <span
                            aria-hidden
                            className="inline-block h-[5px] w-[5px] rounded-full"
                            style={{ background: active ? "var(--accent)" : "var(--line-2)" }}
                          />
                          {item.label}
                        </span>
                        {item.badge ? (
                          <span
                            className="num rounded-full px-1.5 py-px text-[10px] font-semibold"
                            style={{ background: "var(--critical-soft)", color: "var(--critical-ink)" }}
                          >
                            {item.badge}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="px-5 py-4 text-[11px]" style={{ borderTop: "1px solid var(--line)", color: "var(--ink-3)" }}>
          <p className="font-semibold" style={{ color: "var(--ink-2)" }}>
            {org}
          </p>
          <p className="mt-0.5">Sightline · demo environment</p>
        </div>
      </aside>
    </>
  );
}

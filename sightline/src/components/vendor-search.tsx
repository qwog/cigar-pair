"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function VendorSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");

  return (
    <form
      role="search"
      className="relative w-[190px] sm:w-[260px]"
      onSubmit={(event) => {
        event.preventDefault();
        router.push(`/vendors?q=${encodeURIComponent(value.trim())}`);
      }}
    >
      <label htmlFor="vendor-search" className="sr-only">
        Search vendors
      </label>
      <span
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px]"
        style={{ color: "var(--ink-3)" }}
      >
        ⌕
      </span>
      <input
        id="vendor-search"
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search vendors…"
        className="field h-9 pl-8 text-[13px]"
        style={{ background: "var(--surface)" }}
      />
    </form>
  );
}

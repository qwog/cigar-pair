"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const denied = /cannot perform this action|not found|outside your department|refused/i.test(error.message);

  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <p className="eyebrow">{denied ? "Access denied" : "Something went wrong"}</p>
      <h1 className="mt-2 text-[22px] font-semibold tracking-[-0.02em]" style={{ color: "var(--ink)" }}>
        {denied ? "Your role cannot open this page" : "Sightline could not load this view"}
      </h1>
      <p className="mt-2 text-[13px]" style={{ color: "var(--ink-2)" }}>
        {denied
          ? "Ask a Sightline administrator to grant the capability you need. The attempt has been recorded in the audit log."
          : "The error has been logged. Try again, or head back to the overview."}
      </p>
      <div className="mt-5 flex items-center justify-center gap-2">
        <button type="button" className="btn" onClick={reset}>
          Try again
        </button>
        <Link href="/dashboard" className="btn btn-primary">
          Back to overview
        </Link>
      </div>
    </div>
  );
}

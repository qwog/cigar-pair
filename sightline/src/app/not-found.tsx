import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="eyebrow">404</p>
        <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.02em]" style={{ color: "var(--ink)" }}>
          That page is not in your portfolio
        </h1>
        <p className="mt-2 text-[13px]" style={{ color: "var(--ink-2)" }}>
          The vendor, contract or report you asked for either does not exist or sits outside what your role can see.
        </p>
        <Link href="/dashboard" className="btn btn-primary mt-5">
          Back to overview
        </Link>
      </div>
    </main>
  );
}

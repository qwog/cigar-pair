export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="Sightline">
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <path
        d="M7 21.5 13 14l4.5 5.2L25 9.5"
        fill="none"
        stroke="var(--accent-ink)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="25" cy="9.5" r="2.6" fill="var(--accent-ink)" />
    </svg>
  );
}

export function Wordmark({ size = 26 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <Logo size={size} />
      <span className="text-[15px] font-semibold tracking-[-0.01em]" style={{ color: "var(--ink)" }}>
        Sightline
      </span>
    </span>
  );
}

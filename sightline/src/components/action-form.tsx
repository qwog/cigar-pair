"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/app/(app)/actions";

function Pending({ label, pendingLabel, className }: { label: string; pendingLabel: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Saving…",
  submitClass = "btn btn-primary btn-sm",
  className = "",
  footer,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  submitClass?: string;
  className?: string;
  footer?: React.ReactNode;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  return (
    <form action={formAction} className={className}>
      {children}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Pending label={submitLabel} pendingLabel={pendingLabel} className={submitClass} />
        {footer}
        {state.ok ? (
          <p role="status" className="text-[12px] font-medium" style={{ color: "var(--good-ink)" }}>
            {state.ok}
          </p>
        ) : null}
        {state.error ? (
          <p role="alert" className="text-[12px] font-medium" style={{ color: "var(--critical-ink)" }}>
            {state.error}
          </p>
        ) : null}
      </div>
    </form>
  );
}

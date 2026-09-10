"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { signIn, type LoginState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary mt-1 h-[38px] w-full" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export function LoginForm({ demoPassword }: { demoPassword: string }) {
  const [state, action] = useActionState<LoginState, FormData>(signIn, {});
  const [email, setEmail] = useState(state.email ?? "");
  const [password, setPassword] = useState("");

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error ? (
        <p
          role="alert"
          className="rounded-lg px-3 py-2.5 text-[13px]"
          style={{ background: "var(--critical-soft)", color: "var(--critical-ink)" }}
        >
          {state.error}
        </p>
      ) : null}

      <div>
        <label className="label" htmlFor="email">
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="field"
          placeholder="you@company.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="field"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      <Submit />

      <button
        type="button"
        className="btn btn-ghost h-8 w-full text-[12px]"
        onClick={() => {
          setEmail("dana.reyes@arclight.systems");
          setPassword(demoPassword);
        }}
      >
        Fill administrator demo credentials
      </button>
    </form>
  );
}

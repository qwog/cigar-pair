"use client";
import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const stored = localStorage.getItem("sl-theme");
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);

  function apply(next: Theme) {
    setTheme(next);
    if (next === "system") {
      localStorage.removeItem("sl-theme");
      document.documentElement.removeAttribute("data-theme");
    } else {
      localStorage.setItem("sl-theme", next);
      document.documentElement.setAttribute("data-theme", next);
    }
  }

  const options: { value: Theme; label: string; glyph: string }[] = [
    { value: "light", label: "Light", glyph: "☀" },
    { value: "system", label: "System", glyph: "◐" },
    { value: "dark", label: "Dark", glyph: "☾" },
  ];

  return (
    <div
      className="flex items-center gap-0.5 rounded-lg p-0.5"
      style={{ background: "var(--surface-3)" }}
      role="group"
      aria-label="Colour theme"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => apply(option.value)}
          aria-pressed={theme === option.value}
          title={`${option.label} theme`}
          className="flex h-6 w-7 items-center justify-center rounded-[6px] text-[12px] transition-colors"
          style={
            theme === option.value
              ? { background: "var(--surface)", color: "var(--ink)", boxShadow: "var(--shadow-sm)" }
              : { color: "var(--ink-3)" }
          }
        >
          <span aria-hidden>{option.glyph}</span>
          <span className="sr-only">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

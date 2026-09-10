"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/** Measures a container so charts can be drawn at real pixel sizes (no viewBox stretching). */
export function useSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  const attach = useCallback((node: T | null) => {
    ref.current = node;
    if (node) setWidth(node.clientWidth);
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 0;
      setWidth((prev) => (Math.abs(prev - next) > 0.5 ? next : prev));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref: attach, width };
}

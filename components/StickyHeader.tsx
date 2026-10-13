"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Measures its height into --header-h so each page's sticky filter bar pins below
// it; the height varies with viewport and font load, so it can't be hard-coded.
export default function StickyHeader({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const update = () =>
      root.style.setProperty("--header-h", `${el.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <header
      ref={ref}
      className="sticky top-0 z-30 -mx-4 mb-6 flex flex-col gap-3 border-b border-border bg-background/80 px-4 py-4 backdrop-blur"
    >
      {children}
    </header>
  );
}

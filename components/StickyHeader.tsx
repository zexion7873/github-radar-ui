"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Sticky top bar holding the title + nav, so the user can switch tabs without
// scrolling back up. It measures its own height into the --header-h CSS variable
// so each page's sticky filter bar can pin directly BELOW it: two stacked
// stickies in one scroll container both at top:0 would overlap, so the lower
// one's `top` must equal this height — and that height changes with viewport /
// font load, so it's measured, not hard-coded.
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

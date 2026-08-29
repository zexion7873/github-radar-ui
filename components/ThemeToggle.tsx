"use client";

import { useSyncExternalStore } from "react";

// The `.dark` class on <html> is the source of truth (set pre-paint by the inline
// script, then by toggle()). Read it with useSyncExternalStore so `aria-pressed`
// mirrors the real theme for AT without a setState-in-effect: getServerSnapshot
// keeps SSR/hydration at false, and the MutationObserver re-reads it on every
// class change (so toggling updates aria-pressed with no extra state).
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}
const isDarkNow = () => document.documentElement.classList.contains("dark");

export default function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, isDarkNow, () => false);

  function toggle() {
    const isDark = document.documentElement.classList.toggle("dark");
    // Cookie (not localStorage) so the server can render the .dark class on <html>
    // and the theme survives soft navigations like logout's redirect.
    document.cookie = `theme=${isDark ? "dark" : "light"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      aria-label="切換深色模式"
      className="shrink-0 rounded-none p-1.5 text-muted transition-colors hover:text-foreground"
    >
      {/* Stroked line icons in currentColor — the site's ink-only iconography, no
          emoji. "Switch-to" convention: moon offers dark mode, sun offers light. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 dark:hidden"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="hidden h-4 w-4 dark:block"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    </button>
  );
}

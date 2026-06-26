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
      className="shrink-0 rounded-full p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      <span aria-hidden="true" className="dark:hidden">🌙</span>
      <span aria-hidden="true" className="hidden dark:inline">☀️</span>
    </button>
  );
}

"use client";

// No React state: toggling the `.dark` class on <html> drives every `dark:`
// utility, and the icons swap via CSS — so the server render needs no knowledge
// of the current theme and there's no hydration mismatch.
export default function ThemeToggle() {
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
      aria-label="切換深色模式"
      className="shrink-0 rounded-full p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      <span aria-hidden="true" className="dark:hidden">🌙</span>
      <span aria-hidden="true" className="hidden dark:inline">☀️</span>
    </button>
  );
}

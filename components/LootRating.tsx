"use client";

import { useEffect, useRef, useState } from "react";
import { setLootRecommendation } from "@/app/loot/actions";

// 1-5 star control: clicking a star sets that rating (idempotent — re-tapping the
// same star keeps it, so rapid taps don't accidentally clear it); the ✕ clears it
// (→ null). Taps update the display instantly and debounce the Notion write, so
// rapid re-rating doesn't lag and only the last tap in a burst persists.
export default function LootRating({
  pageId,
  value,
}: {
  pageId: string;
  value: number | null;
}) {
  const [display, setDisplay] = useState(value ?? 0);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const starRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Roving-tabindex keyboard model expected of a radiogroup: ←/↓ and →/↑ move
  // to the adjacent star (clamped 1-5), set it, and follow focus there. The
  // current value is the single tab stop (the first star when unrated).
  function onStarKey(e: React.KeyboardEvent, n: number) {
    // Backspace/Delete clears to unrated, so the keyboard radiogroup can reach the
    // same null state the ✕ button gives mouse users (arrows clamp at 1, never 0).
    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      rate(0);
      starRefs.current[0]?.focus();
      return;
    }
    let next: number;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = Math.min(5, n + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown")
      next = Math.max(1, n - 1);
    else return;
    e.preventDefault();
    rate(next);
    starRefs.current[next - 1]?.focus();
  }

  // Adopt the server value when it changes, unless the user has an unsaved tap.
  useEffect(() => {
    if (!dirty.current) setDisplay(value ?? 0);
  }, [value]);

  function rate(next: number) {
    setDisplay(next);
    setFailed(false);
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await setLootRecommendation(pageId, next);
        setFailed(false);
      } catch {
        // Keep the intended rating on screen (don't snap back to the stale value)
        // and surface a retry, so the user knows the write didn't land.
        setFailed(true);
      } finally {
        dirty.current = false;
      }
    }, 400);
  }

  return (
    <div className="flex items-center gap-1">
      <div role="radiogroup" aria-label="推薦評分" className="flex items-center">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            ref={(el) => {
              starRefs.current[n - 1] = el;
            }}
            type="button"
            role="radio"
            aria-checked={n === display}
            aria-label={`${n} 星`}
            tabIndex={n === (display || 1) ? 0 : -1}
            onClick={() => rate(n)}
            onKeyDown={(e) => onStarKey(e, n)}
            className="flex min-h-11 min-w-11 items-center justify-center rounded text-2xl leading-none transition-transform focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none active:scale-90 dark:focus-visible:ring-zinc-500"
          >
            <span
              className={
                n <= display
                  ? "text-amber-400"
                  : "text-zinc-300 dark:text-zinc-600"
              }
            >
              ★
            </span>
          </button>
        ))}
      </div>
      {display > 0 && (
        <button
          type="button"
          onClick={() => rate(0)}
          aria-label="清除評分"
          className="flex min-h-11 min-w-11 items-center justify-center rounded text-sm text-zinc-400 transition-colors hover:text-zinc-600 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none dark:hover:text-zinc-300 dark:focus-visible:ring-zinc-500"
        >
          ✕
        </button>
      )}
      {failed && (
        <span
          role="status"
          aria-live="polite"
          className="ml-1 text-xs text-red-500"
        >
          更新失敗{" "}
          <button
            type="button"
            onClick={() => rate(display)}
            className="font-medium underline focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none"
          >
            重試
          </button>
        </span>
      )}
    </div>
  );
}

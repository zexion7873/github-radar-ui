"use client";

import { useEffect, useRef, useState } from "react";
import { setLootRecommendation } from "@/app/loot/actions";

// Five star buttons; clicking the current rating clears it (0 → null in Notion).
// Taps update the display instantly and are debounced: only the last tap in a
// burst writes to Notion, so rapid re-rating never lags on the per-write refetch
// and concurrent writes can't race.
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

  // Adopt the server value when it changes (write resolved / reload), unless the
  // user has an unsaved tap in flight — then keep their pending choice.
  useEffect(() => {
    if (!dirty.current) setDisplay(value ?? 0);
  }, [value]);

  function rate(n: number) {
    const next = n === display ? 0 : n;
    setDisplay(next);
    setFailed(false);
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await setLootRecommendation(pageId, next);
      } catch {
        setFailed(true);
        setDisplay(value ?? 0); // the write didn't land; don't show a fake rating
      } finally {
        dirty.current = false;
      }
    }, 400);
  }

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} 星`}
          aria-pressed={n <= display}
          onClick={() => rate(n)}
          className="rounded p-2 text-lg leading-none transition-transform focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none active:scale-90 dark:focus-visible:ring-zinc-500"
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
      {failed && <span className="ml-1 text-xs text-red-500">更新失敗</span>}
    </div>
  );
}

"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setLootRecommendation } from "@/app/loot/actions";

// Five star buttons; clicking the current rating clears it (sets 0 → null in Notion).
// Optimistic so the fill updates instantly while the action + updateTag resolve.
export default function LootRating({
  pageId,
  value,
}: {
  pageId: string;
  value: number | null;
}) {
  const [optimistic, setOptimistic] = useOptimistic(value ?? 0);
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  return (
    <div className="flex items-center gap-1" aria-busy={pending}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={pending}
          aria-label={`${n} 星`}
          aria-pressed={n <= optimistic}
          onClick={() =>
            startTransition(async () => {
              const next = n === optimistic ? 0 : n;
              setOptimistic(next);
              setFailed(false);
              try {
                await setLootRecommendation(pageId, next);
              } catch {
                setFailed(true);
              }
            })
          }
          className="rounded p-2 text-lg leading-none transition-transform focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none active:scale-90 disabled:cursor-default dark:focus-visible:ring-zinc-500"
        >
          <span
            className={
              n <= optimistic
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

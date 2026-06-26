"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setLootStatus } from "@/app/loot/actions";
import { STATUS_LABEL } from "./ui";

const STATUSES = ["new", "adopted", "skipped"] as const;

const ACTIVE: Record<string, string> = {
  new: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  adopted: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  skipped: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
};

export default function LootStatusControl({
  pageId,
  status,
}: {
  pageId: string;
  status: string;
}) {
  // Optimistic flips the highlight instantly; once the action + updateTag resolve,
  // the server re-renders and the card moves to its new Status group with the real value.
  const [optimistic, setOptimistic] = useOptimistic(status);
  const [pending, startTransition] = useTransition();
  // The status the user picked that failed to save. On failure we keep showing
  // THIS value (not a silent snap-back to the stale server value) plus a red ring
  // and a real retry, so the user can tell the write didn't land.
  const [failed, setFailed] = useState<string | null>(null);

  const active = failed ?? optimistic;

  function commit(s: string) {
    startTransition(async () => {
      setOptimistic(s);
      setFailed(null);
      try {
        await setLootStatus(pageId, s);
      } catch {
        setFailed(s);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1" aria-busy={pending}>
      <div className="flex gap-1">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            disabled={pending || s === active}
            onClick={() => commit(s)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none disabled:cursor-default dark:focus-visible:ring-zinc-500 ${
              s === active
                ? `${ACTIVE[s]}${failed === s ? " ring-2 ring-red-400" : ""}`
                : "text-zinc-400 hover:bg-zinc-100 dark:text-zinc-500 dark:hover:bg-zinc-800"
            }`}
          >
            {STATUS_LABEL[s] ?? s}
          </button>
        ))}
      </div>
      {failed && (
        <p role="status" aria-live="polite" className="text-xs text-red-500">
          更新失敗 ——{" "}
          <button
            type="button"
            onClick={() => commit(failed)}
            className="font-medium underline focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none"
          >
            重試
          </button>
        </p>
      )}
    </div>
  );
}

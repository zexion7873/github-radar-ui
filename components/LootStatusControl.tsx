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
  const [failed, setFailed] = useState(false);

  return (
    <div className="flex flex-col gap-1" aria-busy={pending}>
      <div className="flex gap-1">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            disabled={pending || s === optimistic}
            onClick={() =>
              startTransition(async () => {
                setOptimistic(s);
                setFailed(false);
                try {
                  await setLootStatus(pageId, s);
                } catch {
                  // The optimistic highlight reverts automatically; surface the failure
                  // so the snap-back isn't silent (e.g. session expired, Notion error).
                  setFailed(true);
                }
              })
            }
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none disabled:cursor-default dark:focus-visible:ring-zinc-500 ${
              s === optimistic
                ? ACTIVE[s]
                : "text-zinc-400 hover:bg-zinc-100 dark:text-zinc-500 dark:hover:bg-zinc-800"
            }`}
          >
            {STATUS_LABEL[s] ?? s}
          </button>
        ))}
      </div>
      {failed && <p className="text-xs text-red-500">更新失敗，請重試</p>}
    </div>
  );
}

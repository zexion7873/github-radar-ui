"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setLootStatus } from "@/app/loot/actions";
import { LOOT_STATUSES, type LootTarget } from "@/lib/config";
import { STATUS_LABEL } from "./ui";

const STATUSES = LOOT_STATUSES;

// Neutral, not a status colour: the board's spine already carries the status hue.
const ACTIVE_CLASS = "bg-foreground/10 text-foreground";

export default function LootStatusControl({
  pageId,
  status,
  target,
}: {
  pageId: string;
  status: string;
  target: LootTarget;
}) {
  // Optimistic flips the highlight instantly; once the action + updateTag resolve,
  // the server re-renders and the card moves to its new Status group with the real value.
  const [optimistic, setOptimistic] = useOptimistic(status);
  const [pending, startTransition] = useTransition();
  // A failed pick stays shown with a retry, so a lost write never snaps back silently.
  const [failed, setFailed] = useState<string | null>(null);

  const active = failed ?? optimistic;

  function commit(s: string) {
    startTransition(async () => {
      setOptimistic(s);
      setFailed(null);
      try {
        await setLootStatus(target, pageId, s);
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
            // Not `disabled`, which drops focus mid-interaction: aria-pressed and a
            // no-op click instead.
            aria-pressed={s === active}
            aria-disabled={pending || s === active}
            onClick={() => {
              if (pending || s === active) return;
              commit(s);
            }}
            className={`flex-1 cursor-pointer rounded-none px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:outline-none ${
              s === active
                ? `${ACTIVE_CLASS}${failed === s ? " ring-2 ring-danger/60" : ""} cursor-default`
                : "border border-border text-muted hover:text-foreground"
            }`}
          >
            {STATUS_LABEL[s] ?? s}
          </button>
        ))}
      </div>
      {failed && (
        <p role="status" aria-live="polite" className="text-xs text-danger">
          更新失敗 ——{" "}
          <button
            type="button"
            onClick={() => commit(failed)}
            className="font-medium underline focus-visible:ring-2 focus-visible:ring-danger/60 focus-visible:outline-none"
          >
            重試
          </button>
        </p>
      )}
    </div>
  );
}

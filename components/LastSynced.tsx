"use client";

import { useSyncExternalStore } from "react";
import { formatWeek } from "./ui";

const STALE_DAYS = 8;
const noopSubscribe = () => () => {};

// No real "synced at" exists, so the caller passes the newest source date. The clock
// goes through useSyncExternalStore: render can't read it and an effect can't set it.
export default function LastSynced({ iso }: { iso: string }) {
  const stale = useSyncExternalStore(
    noopSubscribe,
    () => Date.now() - Date.parse(iso) > STALE_DAYS * 86_400_000,
    () => false,
  );

  return (
    <p
      className={`text-xs ${stale ? "text-accent" : "text-muted"}`}
    >
      資料最新到 {formatWeek(iso)}
      {stale && "（來源可能已停更）"}
    </p>
  );
}

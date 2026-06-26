"use client";

import { useSyncExternalStore } from "react";
import { formatWeek } from "./ui";

const STALE_DAYS = 8;
const noopSubscribe = () => () => {};

// Dashboard freshness signal. There's no real "synced at" timestamp, so the
// caller passes the newest source date across the tables. Staleness needs the
// wall clock, which can't be read during render (purity rule) nor set from an
// effect (set-state-in-effect rule) — so we read it via useSyncExternalStore,
// the same escape hatch ThemeToggle uses: getSnapshot reads Date.now() on the
// client and returns a STABLE boolean (no resnapshot loop), the server snapshot
// is always false. Past STALE_DAYS the upstream routines have probably stalled;
// the amber warning stops dead data from masquerading as fresh and the 🆕 badge
// from vouching for it silently.
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
      {stale && "⚠ "}資料最新到 {formatWeek(iso)}
      {stale && "（來源可能已停更）"}
    </p>
  );
}

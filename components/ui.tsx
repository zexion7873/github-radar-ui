import { type ReactNode } from "react";

// Shared card surface so every card (trending / loot / stats) gets the same
// border, shadow, and hover lift — change the look once, it propagates.
export const cardClass =
  "rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900";
export const cardInteractive = `${cardClass} transition-shadow duration-200 hover:border-zinc-300 hover:shadow-md dark:hover:border-zinc-700`;

type Tone = "gray" | "blue" | "green" | "amber" | "purple";

// Dark fills use a translucent -500/15 + ring instead of -950: a solid -950 sits
// at almost the same luminance as the dark card/body, so the pill loses its shape
// and the colour signal disappears. The light side is unchanged.
const TONE: Record<Tone, string> = {
  gray: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-1 dark:ring-blue-500/25",
  green: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300 dark:ring-1 dark:ring-green-500/25",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-1 dark:ring-amber-500/25",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300 dark:ring-1 dark:ring-purple-500/25",
};

export function Badge({
  children,
  tone = "gray",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}

// Filter pill, shared by every filter bar (trending / blog / loot) so the chips
// and their active state stay locked together. `aria-pressed` lets AT announce
// which filter is on; wrap a row of these in a role="group" with a label.
export function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none active:scale-95 dark:focus-visible:ring-zinc-500 ${
        on
          ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      }`}
    >
      {children}
    </button>
  );
}

// Loot status enum → display label. The raw enum (new/adopted/skipped) stays the
// stored/state value; translate only at render so the Chinese UI never shows the
// schema. Shared by LootBoard (chips + group header) and LootStatusControl.
export const STATUS_LABEL: Record<string, string> = {
  new: "待處理",
  adopted: "已採用",
  skipped: "已略過",
};

// Trending/Blog category → badge tone, shared by the trending list and the
// dashboard so a category wears the same colour everywhere.
export const CATEGORY_TONE: Record<string, Tone> = {
  agents: "purple",
  models: "blue",
  infra: "green",
  tooling: "amber",
  apps: "gray",
  other: "gray",
};

// Loot status → badge tone. Kept in its own map (not borrowing CATEGORY_TONE) so
// "blue" can mean a category on /trending and a status on /loot without the two
// silently colliding — each concept owns its hue within its own surface.
export const STATUS_TONE: Record<string, Tone> = {
  new: "blue",
  adopted: "green",
  skipped: "gray",
};

// One fixed tone for every "fresh this week" 🆕 badge (trending + blog), so the
// freshness cue reads the same everywhere instead of being amber on one page and
// green on another.
export const FRESH_TONE: Tone = "green";

export function Notice({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      <p className="font-semibold">{title}</p>
      <div className="mt-2 leading-relaxed">{children}</div>
    </div>
  );
}

export function DataError({ error }: { error: string }) {
  if (error.includes("NOTION_TOKEN")) {
    return (
      <Notice title="尚未設定 Notion token">
        <p>
          Add your Notion internal integration token to{" "}
          <code className="font-mono">.env.local</code>:
        </p>
        <pre className="mt-2 overflow-x-auto rounded bg-amber-100 p-2 text-xs dark:bg-amber-900/40">
          NOTION_TOKEN=ntn_xxx
        </pre>
        <p className="mt-2">
          Then share the three archive databases into the integration (Notion →
          ••• → Connections) and reload.
        </p>
      </Notice>
    );
  }
  return (
    <Notice title="讀取 Notion 失敗">
      <p className="font-mono text-xs">{error}</p>
      <p className="mt-2">
        Common causes: the database is not shared with the integration, or the
        token / API version is wrong.
      </p>
    </Notice>
  );
}

export function formatWeek(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${Number(m)}/${Number(d)}/${y.slice(2)}`;
}

import { type ReactNode } from "react";
import Link from "next/link";

export const cardClass = "rounded-none border border-border bg-surface";
export const cardInteractive = `${cardClass} transition-colors duration-[var(--dur-ink)] ease-[var(--ease-ink)] hover:border-ink-2`;

// accent = hot / needs attention, pos = adopted / positive, muted = everything else.
type Tone = "muted" | "accent" | "pos";

const TONE: Record<Tone, string> = {
  muted: "border-border text-muted",
  accent: "border-accent text-accent",
  pos: "border-pos text-pos",
};

export function Badge({
  children,
  tone = "muted",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  // Escape hatch for colours outside the 3-tone set (license badges mirror the
  // Notion SELECT palette); when set it replaces the tone classes.
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-none border px-1.5 py-0 font-mono text-[11px] tracking-[0.08em] uppercase ${className ?? TONE[tone]}`}
    >
      {children}
    </span>
  );
}

// Shared by Chip and ChipLink so the two stay pixel-identical.
function chipClass(on: boolean): string {
  return `shrink-0 rounded-none border px-3 py-1 font-mono text-[11px] tracking-[0.08em] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:outline-none active:scale-95 ${
    on
      ? "border-foreground bg-foreground text-background"
      : "border-border text-muted hover:border-foreground hover:text-foreground"
  }`;
}

// `aria-pressed` lets AT announce which filter is on; wrap a row of these in a
// role="group" with a label (ChipScroller does this for you).
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
      className={chipClass(on)}
    >
      {children}
    </button>
  );
}

// Chip's look for real navigation; `aria-current` marks the active one, as in Nav.
export function ChipLink({
  href,
  on,
  children,
}: {
  href: string;
  on: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={chipClass(on)}
    >
      {children}
    </Link>
  );
}

// One swipeable line on mobile, so wrapped chips don't eat the viewport under the
// sticky header; wraps on sm+.
export function ChipScroller({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="relative">
      <div
        className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-x-visible sm:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label={label}
      >
        {children}
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent sm:hidden"
      />
    </div>
  );
}

// The stored enum stays the state value; translate only at render.
export const STATUS_LABEL: Record<string, string> = {
  new: "待處理",
  deferred: "觀望",
  adopted: "已採用",
  skipped: "已略過",
};

// All neutral, so the single accent keeps meaning hot / fresh / pending.
export const CATEGORY_TONE: Record<string, Tone> = {
  agents: "muted",
  models: "muted",
  infra: "muted",
  tooling: "muted",
  apps: "muted",
  other: "muted",
};

// Only the dashboard's 本週分類 bar may use these; badges stay muted. An unmapped
// Category falls back to `other`.
export const CATEGORY_HUE: Record<string, string> = {
  agents: "bg-cat-agents",
  models: "bg-cat-models",
  infra: "bg-cat-infra",
  tooling: "bg-cat-tooling",
  apps: "bg-cat-apps",
  other: "bg-cat-other",
};

// Here, not in server-only data.ts, so client components can import it.
export const MOMENTUM_HOT = 1.5;

// Only pending wears the accent; deferred and skipped stay neutral.
export const STATUS_TONE: Record<string, Tone> = {
  new: "accent",
  deferred: "muted",
  adopted: "pos",
  skipped: "muted",
};

// The accent marks only 待處理, so a drained queue reads all-neutral.
export const STATUS_SPINE: Record<string, string> = {
  new: "border-l-accent",
  deferred: "border-l-border",
  adopted: "border-l-pos",
  skipped: "border-l-border",
};

// Exception states only (`active` / `none` stay unbadged), and always muted,
// never the accent.
export const MAINTAINED_BADGE: Record<string, string> = {
  stale: "停更",
  archived: "封存",
};
export const RISK_BADGE: Record<string, string> = {
  // `watch` (30–180d) is the norm for trending repos, so only `high` earns a flag.
  high: "高風險",
};

// Only `already-have`: every other verdict maps 1:1 onto a Status the row wears.
export const VERDICT_BADGE: Record<string, string> = {
  "already-have": "早就有",
};

// Pattern-matched, not an enum, so a new SPDX id still renders (muted if unknown).
export function licenseTone(license: string): string {
  if (/GPL/i.test(license)) return "border-danger text-danger"; // copyleft: GPL/AGPL/LGPL
  if (/CC-BY-SA/i.test(license)) return "border-info text-info"; // share-alike
  if (/elastic|busl/i.test(license)) return "border-accent text-accent"; // source-available (Elastic, BUSL — NOT Boost's BSL-1.0)
  if (/MIT|Apache|BSD|MPL|ISC|CC0|Unlicense|0BSD|Zlib|Artistic|Python|PostgreSQL|BSL-1\.0/i.test(license))
    return "border-pos text-pos"; // permissive (incl. Boost BSL-1.0)
  return "border-border text-muted"; // unknown → neutral
}

// One fixed tone for every fresh-this-week badge (trending 新上榜 + blog 新): the
// same accent as pending, so freshness reads as "hot" everywhere.
export const FRESH_TONE: Tone = "accent";

export function Notice({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-none border border-accent bg-surface p-5 text-sm text-foreground">
      <p className="font-serif-text text-base text-accent">{title}</p>
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
        <pre className="mt-2 overflow-x-auto rounded-none border border-border bg-background p-2 text-xs">
          NOTION_TOKEN=ntn_xxx
        </pre>
        <p className="mt-2">
          Then share every archive database in{" "}
          <code className="font-mono">lib/config.ts</code>&apos;s{" "}
          <code className="font-mono">TABLES</code> into the integration (Notion
          → ••• → Connections) and reload.
        </p>
      </Notice>
    );
  }
  return (
    <Notice title="讀取 Notion 失敗">
      <p>暫時無法讀取資料，請稍後再試。</p>
      <p className="mt-2">
        Common causes: the database is not shared with the integration, or the
        token / API version is wrong.
      </p>
    </Notice>
  );
}

export function formatWeek(iso: string | null): string {
  if (!iso) return "";
  // yyyy/MM/dd — the Notion source is already a zero-padded ISO date (YYYY-MM-DD).
  return iso.slice(0, 10).replace(/-/g, "/");
}

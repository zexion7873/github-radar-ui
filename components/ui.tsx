import { type ReactNode } from "react";

// Shared card surface so every card (trending / loot / stats) gets the same
// border and hover treatment — change the look once, it propagates. Editorial:
// zero radius, hairline border, no shadow; depth comes from the border darkening
// to ink on hover, not from a lift.
export const cardClass = "rounded-none border border-border bg-surface";
export const cardInteractive = `${cardClass} transition-colors duration-[var(--dur-ink)] ease-[var(--ease-ink)] hover:border-ink-2`;

// Three semantic outline tones — the editorial palette trades the old five-colour
// pill rainbow for one accent (terracotta) meaning "hot / needs attention", a
// muted green for "adopted / positive", and neutral for everything else.
type Tone = "muted" | "accent" | "pos";

const TONE: Record<Tone, string> = {
  muted: "border-border text-muted",
  accent: "border-accent text-accent",
  pos: "border-pos text-pos",
};

export function Badge({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-none border px-1.5 py-0 font-mono text-[11px] tracking-[0.08em] uppercase ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}

// Filter pill → editorial square chip. Active = solid ink block; inactive = a
// hairline outline that darkens to ink on hover. `aria-pressed` lets AT announce
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
      className={`shrink-0 rounded-none border px-3 py-1 font-mono text-[11px] tracking-[0.08em] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:outline-none active:scale-95 ${
        on
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted hover:border-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

// A row of filter chips that scrolls horizontally on mobile (chips overflow into
// one swipeable line instead of wrapping into many tall rows that eat the
// viewport under the sticky header), reverting to wrap on sm+. The right-edge
// gradient hints there's more to scroll — mobile only, since the desktop wrap
// already shows every chip.
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

// Loot status enum → display label. The raw enum (new/adopted/skipped) stays the
// stored/state value; translate only at render so the Chinese UI never shows the
// schema. Shared by LootBoard (chips + group header) and LootStatusControl.
export const STATUS_LABEL: Record<string, string> = {
  new: "待處理",
  adopted: "已採用",
  skipped: "已略過",
};

// Categories no longer each own a hue — the editorial direction keeps them all
// neutral so the single accent stays meaningful (hot / fresh / pending) instead
// of competing with a category rainbow.
export const CATEGORY_TONE: Record<string, Tone> = {
  agents: "muted",
  models: "muted",
  infra: "muted",
  tooling: "muted",
  apps: "muted",
  other: "muted",
};

// Loot status → outline tone. Pending wears the accent (it's the call to
// action), adopted the positive green, skipped stays neutral.
export const STATUS_TONE: Record<string, Tone> = {
  new: "accent",
  adopted: "pos",
  skipped: "muted",
};

// Status → left-spine border colour, the loot worklist's structural cue. The
// board row and the detail header both wear it, so the status hue lives in one
// place (mirrors STATUS_TONE / STATUS_LABEL). The accent only ever marks 待處理,
// so a drained queue reads as all-neutral ink.
export const STATUS_SPINE: Record<string, string> = {
  new: "border-l-accent",
  adopted: "border-l-pos",
  skipped: "border-l-border",
};

// One fixed tone for every "fresh this week" ✨ badge (trending + blog): the
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
  // yyyy/MM/dd — the Notion source is already a zero-padded ISO date (YYYY-MM-DD).
  return iso.slice(0, 10).replace(/-/g, "/");
}

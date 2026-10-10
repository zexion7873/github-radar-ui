// Notion data-source UUIDs for the GitHub/blog routines' archive tables — one
// entry per table, TABLES below IS the authoritative list (prose elsewhere
// deliberately avoids counting them; a hardcoded "four" survived one table past
// its truth). These are identifiers, not secrets (the same ids live in
// ai-assistant/AGENTS.md); they are useless without NOTION_TOKEN and the
// integration shared into each table.
export const NOTION_VERSION = "2025-09-03"; // version that introduced data sources

export const TABLES = {
  trending: "f67aaa24-d5f2-415c-9358-c7d9d2f9713e",
  lootClaude: "8223d65e-4ed6-4a6e-b8ad-fb0c98c9a4ed",
  lootCopilot: "bafde792-70ff-4e07-9ffd-00ecf77f51be",
  lootOpencode: "12e402c0-8377-4449-b5fb-5b9798388dc3",
  lootCodex: "5d19677c-6f3f-4ec8-a5c3-f7a85e3082e5",
  blog: "d8e442b5-17c1-4e6f-a665-feb49d6e3099",
} as const;

// Each loot target is its own separate Notion table because the upstream
// ai-assistant routines write them as distinct archives (one routine per target).
// This read-only consumer can't collapse them into one table + a Target column —
// that schema decision lives where the tables are written, not here.
export const LOOT_TARGETS = {
  claude: { uuid: TABLES.lootClaude, label: "Claude Code" },
  copilot: { uuid: TABLES.lootCopilot, label: "Copilot" },
  opencode: { uuid: TABLES.lootOpencode, label: "opencode" },
  codex: { uuid: TABLES.lootCodex, label: "Codex" },
} as const;

export type LootTarget = keyof typeof LOOT_TARGETS;

// radar-rag answers questions over the archive. This site's SERVER never calls
// it (it reads Notion only); the /ask page's browser code does, so both values
// are public. The defaults are production; NEXT_PUBLIC_* overrides point local
// dev at a local radar-rag with Cloudflare's always-pass test site key. The URL
// is radar-rag's: change it only together with that service's deploy.
export const RADAR_RAG_URL =
  process.env.NEXT_PUBLIC_RADAR_RAG_URL ??
  "https://radar-rag-50472171523.asia-east1.run.app";
export const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "0x4AAAAAAFTDvuuo53zguas_";
// radar-rag's CORS and the Turnstile widget allow only this host (plus
// localhost for dev), so the /ask page stays inert on preview deployments.
export const PRODUCTION_HOST = "whyisthistrending.vercel.app";

// The single canonical "first" target — Nav's collapsed Loot tab and the
// dashboard's combined pending-count stat both need one default landing spot.
// Insertion order of LOOT_TARGETS decides it, so a newly added target only
// ever appends and never reshuffles which one is default.
export const DEFAULT_LOOT_TARGET: LootTarget = (
  Object.keys(LOOT_TARGETS) as LootTarget[]
)[0];

// Loot Status select options, single source of truth for the read default, the
// write-back whitelist, and the filter/toggle UI (imported by lib + components).
// `deferred` is the verified-but-parked watchlist (triage verdict "trial"):
// vetted good, no current need — kept out of the pending queue so 待處理 keeps
// meaning "not yet triaged". Array order IS lane/button order on the board.
export const LOOT_STATUSES = ["new", "deferred", "adopted", "skipped"] as const;
export type LootStatus = (typeof LOOT_STATUSES)[number];

// The triage pass writes Verdict as `<bucket> — <reason>`; split it so the bucket
// can badge and the reason can read as prose. Free text a human also edits by
// hand in Notion, so a value that doesn't match the contract renders whole as the
// reason rather than vanishing.
export function parseVerdict(verdict: string): {
  bucket: string | null;
  reason: string;
} {
  const m = /^(adopt|trial|skip|already-have)\s*—\s*([\s\S]*)$/.exec(verdict.trim());
  return m ? { bucket: m[1], reason: m[2] } : { bucket: null, reason: verdict };
}

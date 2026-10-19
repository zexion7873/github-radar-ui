// Identifiers, not secrets (ai-assistant/AGENTS.md lists them too): useless
// without NOTION_TOKEN.
export const NOTION_VERSION = "2025-09-03"; // version that introduced data sources

export const TABLES = {
  trending: "f67aaa24-d5f2-415c-9358-c7d9d2f9713e",
  lootClaude: "8223d65e-4ed6-4a6e-b8ad-fb0c98c9a4ed",
  lootCopilot: "bafde792-70ff-4e07-9ffd-00ecf77f51be",
  lootOpencode: "12e402c0-8377-4449-b5fb-5b9798388dc3",
  lootCodex: "5d19677c-6f3f-4ec8-a5c3-f7a85e3082e5",
  blog: "d8e442b5-17c1-4e6f-a665-feb49d6e3099",
} as const;

// One Notion table per target, because ai-assistant writes each as its own archive.
export const LOOT_TARGETS = {
  claude: { uuid: TABLES.lootClaude, label: "Claude Code" },
  copilot: { uuid: TABLES.lootCopilot, label: "Copilot" },
  opencode: { uuid: TABLES.lootOpencode, label: "opencode" },
  codex: { uuid: TABLES.lootCodex, label: "Codex" },
} as const;

export type LootTarget = keyof typeof LOOT_TARGETS;

// Only /ask's browser code reads these, so both are public. Change the URL only
// together with radar-rag's deploy.
export const RADAR_RAG_URL =
  process.env.NEXT_PUBLIC_RADAR_RAG_URL ??
  "https://radar-rag-50472171523.asia-east1.run.app";
export const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "0x4AAAAAAFTDvuuo53zguas_";
// radar-rag's CORS and the Turnstile widget allow only this host (plus
// localhost for dev), so the /ask page stays inert on preview deployments.
// The site's metadataBase uses it too; radar-rag's radar.ui.host must match.
export const PRODUCTION_HOST = "whyisthistrending.vercel.app";

// The first LOOT_TARGETS entry: append new targets so the default never moves.
export const DEFAULT_LOOT_TARGET: LootTarget = (
  Object.keys(LOOT_TARGETS) as LootTarget[]
)[0];

// Also the write allow-list; order is the board's lane order. `deferred` holds
// "trial" verdicts out of 待處理, which means not yet triaged.
export const LOOT_STATUSES = ["new", "deferred", "adopted", "skipped"] as const;
export type LootStatus = (typeof LOOT_STATUSES)[number];

// Verdict is `<bucket> — <reason>`, but people edit it in Notion too: a value off
// that shape renders whole as the reason rather than vanishing.
export function parseVerdict(verdict: string): {
  bucket: string | null;
  reason: string;
} {
  const m = /^(adopt|trial|skip|already-have)\s*—\s*([\s\S]*)$/.exec(verdict.trim());
  return m ? { bucket: m[1], reason: m[2] } : { bucket: null, reason: verdict };
}

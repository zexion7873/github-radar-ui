// Notion data-source UUIDs for the GitHub/blog routines' four archive tables.
// These are identifiers, not secrets (the same ids live in ai-assistant/AGENTS.md);
// they are useless without NOTION_TOKEN and the integration shared into each table.
export const NOTION_VERSION = "2025-09-03"; // version that introduced data sources

export const TABLES = {
  trending: "f67aaa24-d5f2-415c-9358-c7d9d2f9713e",
  lootClaude: "8223d65e-4ed6-4a6e-b8ad-fb0c98c9a4ed",
  lootCopilot: "bafde792-70ff-4e07-9ffd-00ecf77f51be",
  blog: "d8e442b5-17c1-4e6f-a665-feb49d6e3099",
} as const;

// Claude/Copilot loot are two separate Notion tables because the upstream
// ai-assistant routines write them as two distinct archives. This read-only
// consumer can't collapse them into one table + a Target column — that schema
// decision lives where the tables are written, not here.
export const LOOT_TARGETS = {
  claude: { uuid: TABLES.lootClaude, label: "Claude Code" },
  copilot: { uuid: TABLES.lootCopilot, label: "Copilot" },
} as const;

export type LootTarget = keyof typeof LOOT_TARGETS;

// Loot Status select options, single source of truth for the read default, the
// write-back whitelist, and the filter/toggle UI (imported by lib + components).
export const LOOT_STATUSES = ["new", "adopted", "skipped"] as const;
export type LootStatus = (typeof LOOT_STATUSES)[number];

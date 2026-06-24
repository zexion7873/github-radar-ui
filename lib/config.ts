// Notion data-source UUIDs for the three GitHub routines' archive tables.
// These are identifiers, not secrets (the same ids live in ai-assistant/AGENTS.md);
// they are useless without NOTION_TOKEN and the integration shared into each table.
export const NOTION_VERSION = "2025-09-03"; // version that introduced data sources

export const TABLES = {
  trending: "f67aaa24-d5f2-415c-9358-c7d9d2f9713e",
  lootClaude: "8223d65e-4ed6-4a6e-b8ad-fb0c98c9a4ed",
  lootCopilot: "bafde792-70ff-4e07-9ffd-00ecf77f51be",
} as const;

export const LOOT_TARGETS = {
  claude: { uuid: TABLES.lootClaude, label: "Claude Code" },
  copilot: { uuid: TABLES.lootCopilot, label: "Copilot" },
} as const;

export type LootTarget = keyof typeof LOOT_TARGETS;
